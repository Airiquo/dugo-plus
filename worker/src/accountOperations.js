/** Recoverable account operations and their transactional audit outbox. */
import { HttpError } from './http.js'
import { accountProfileSnapshot, normalizeAccountProfile, PROFILE_FIELD_LABELS } from './accountProfile.js'

const TARGET_ID = /^[^/\s]{1,128}$/
const OPERATION_ID = /^[a-zA-Z0-9-]{16,80}$/

export function accountId(value) {
  if (typeof value !== 'string' || !TARGET_ID.test(value))
    throw new HttpError(400, 'Choose a valid account.')
  return value
}

export function operationKey(value) {
  if (typeof value !== 'string' || !OPERATION_ID.test(value))
    throw new HttpError(
      400,
      'A valid operationId is required. Refresh this page and try again.',
    )
  return value
}

function assertAdmin(profile) {
  if (
    !profile ||
    profile.data.role !== 'admin' ||
    (profile.data.status || 'Active') !== 'Active'
  ) {
    throw new HttpError(403, 'An active administrator account is required.')
  }
}

function assertTarget(profile, target, actor) {
  if (target === actor)
    throw new HttpError(412, 'You cannot change your own account access.')
  if (!profile) throw new HttpError(404, 'This account was not found.')
  if (!['donor', 'hospital'].includes(profile.data.role))
    throw new HttpError(403, 'Administrator accounts cannot be changed here.')
  if (
    profile.data.provisioningOperationId ||
    profile.data.loginState === 'Provisioning'
  ) {
    throw new HttpError(412, 'Hospital provisioning is still in progress.')
  }
}

function reasonText(value) {
  const reason = typeof value === 'string' ? value.trim() : ''
  if (!reason || reason.length > 2000)
    throw new HttpError(400, 'Provide a reason of 1–2000 characters.')
  return reason
}

export function dueQuery(collection, now, limit = 20) {
  return {
    from: [{ collectionId: collection }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'state' },
              op: 'EQUAL',
              value: { stringValue: 'Pending' },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'nextAttemptAt' },
              op: 'LESS_THAN_OR_EQUAL',
              value: { timestampValue: now.toISOString() },
            },
          },
        ],
      },
    },
    orderBy: [
      { field: { fieldPath: 'nextAttemptAt' }, direction: 'ASCENDING' },
    ],
    limit,
  }
}

/** Dependencies provide transactional storage, Auth operations, HMAC, and audit delivery. */
export function createAccountManager({
  store,
  identity,
  hash,
  deliver,
  now = () => new Date(),
}) {
  const operationId = (actor, key) =>
    hash(`account-operation:${actor}:${operationKey(key)}`)
  const path = (id) => `accountOperations/${id}`
  const pending = (id) => ({
    operationId: id,
    state: 'Pending',
    message:
      'This account change is still processing. Retry with the same details to check its progress.',
  })

  async function existingOperation(tx, actor, id, fingerprint) {
    assertAdmin(await tx.get('users', actor))
    const existing = await tx.get('accountOperations', id)
    if (!existing) return null
    if (existing.data.fingerprint !== fingerprint)
      throw new HttpError(
        409,
        'This operation was already used with different details.',
      )
    if (existing.data.state === 'Failed')
      throw new HttpError(
        412,
        existing.data.failureMessage ||
          'This operation failed. Start a new request.',
      )
    return existing.data
  }

  function finish(
    tx,
    id,
    op,
    eventType,
    beforeStatus,
    afterStatus,
    result = {},
    create = false,
  ) {
    const at = now()
    tx.create(`auditOutbox/${id}`, {
      state: 'Pending',
      nextAttemptAt: at,
      createdAt: at,
      eventType,
      entityType: 'user',
      entityId: op.targetUid,
      actorId: op.actorId,
      actorRole: 'admin',
      context: { reason: op.reason, beforeStatus, afterStatus },
    })
    const completed = {
      reason: '',
      leaseToken: null,
      leaseUntil: null,
      state: 'Completed',
      completedAt: at,
      updatedAt: at,
      result: { uid: op.targetUid, ...result },
    }
    if (create) tx.create(path(id), { ...op, ...completed })
    else tx.update(path(id), completed)
  }

  async function resultFor(id) {
    const op = await store.get('accountOperations', id)
    if (op?.data.state === 'Failed')
      throw new HttpError(
        412,
        op.data.failureMessage || 'This operation failed. Start a new request.',
      )
    if (op?.data.state !== 'Completed') return pending(id)
    let auditRecorded = false
    try {
      await deliver(id)
      auditRecorded = true
    } catch {
      /* The outbox remains pending. */
    }
    return {
      ...op.data.result,
      state: 'Completed',
      operationId: id,
      auditRecorded,
      auditState: auditRecorded ? 'Recorded' : 'Pending',
    }
  }

  async function editableAccount(tx, target, actor) {
    const profile = await tx.get('users', target)
    assertTarget(profile, target, actor)
    if (!['Active', 'Suspended'].includes(profile.data.status || 'Active') ||
        profile.data.personalDataErased || ['Deleting', 'Deleted'].includes(profile.data.loginState) ||
        profile.data.loginDeletedAt)
      throw new HttpError(412, 'This account is closed, erased, or its sign-in is unavailable. Its profile cannot be edited.')
    const hospital = profile.data.role === 'hospital'
      ? await tx.get('hospitals', accountId(profile.data.hospitalId)) : null
    if (profile.data.role === 'hospital' && (!hospital || hospital.data.provisioningOperationId))
      throw new HttpError(412, 'The linked facility is missing or still being set up.')
    const snapshot = accountProfileSnapshot(profile, hospital)
    const revision = await hash(JSON.stringify({ snapshot,
      profileUpdatedAt: profile.data.updatedAt || null,
      facilityUpdatedAt: hospital?.data.updatedAt || null,
    }))
    return { profile, hospital, snapshot, revision }
  }

  async function getProfile(target, actor) {
    accountId(target)
    return store.transact(async (tx) => {
      assertAdmin(await tx.get('users', actor))
      const { snapshot, revision } = await editableAccount(tx, target, actor)
      return { ...snapshot, revision }
    })
  }

  async function editProfile(input, actor, key) {
    const target = accountId(input.uid)
    const reason = reasonText(input.reason)
    if (reason.length > 1500) throw new HttpError(400, 'Keep the edit reason to 1500 characters or fewer.')
    if (typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision))
      throw new HttpError(400, 'Reload the account details before saving.')
    const id = await operationId(actor, key)
    const fingerprint = await hash(JSON.stringify({ action: 'editProfile', input }))
    await store.transact(async (tx) => {
      if (await existingOperation(tx, actor, id, fingerprint)) return
      const { profile, hospital, revision } = await editableAccount(tx, target, actor)
      if (input.revision !== revision)
        throw new HttpError(412, 'These details changed while you were editing. Reload them before saving.')
      const next = normalizeAccountProfile(input, profile.data.role, now())
      const changes = []
      for (const [scope, previous, updated] of [
        ['Profile', profile.data, next.profile], ['Facility', hospital?.data, next.facility],
      ]) {
        if (!updated) continue
        for (const [field, value] of Object.entries(updated)) {
          if (field === 'geohash') continue
          const emptyValue = ['latitude', 'longitude'].includes(field) ? 0 : typeof value === 'string' ? '' : null
          if (JSON.stringify(previous[field] ?? emptyValue) !== JSON.stringify(value))
            changes.push(`${scope}: ${PROFILE_FIELD_LABELS[field]}`)
        }
      }
      if (!changes.length) throw new HttpError(400, 'Change at least one field before saving.')
      const mirror = profile.data.role === 'donor'
        ? await tx.get('donorLocations', target) : null
      const at = now()
      tx.update(`users/${target}`, { ...next.profile, updatedAt: at })
      if (hospital) tx.update(`hospitals/${hospital.id}`, { ...next.facility, updatedAt: at })
      if (profile.data.role === 'donor') {
        if (next.profile.geohash) {
          const { latitude, longitude, city, geohash, bloodType } = next.profile
          const location = { donorId: target, latitude, longitude, city, geohash, bloodType, updatedAt: at }
          if (mirror) tx.update(`donorLocations/${target}`, location)
          else tx.create(`donorLocations/${target}`, location)
        } else if (mirror) tx.delete(`donorLocations/${target}`)
      }
      const status = profile.data.status || 'Active'
      finish(tx, id, { action: 'editProfile', actorId: actor, targetUid: target, fingerprint,
        createdAt: at, reason: `Updated fields: ${changes.join('; ')}. Reason: ${reason}` },
      'Account.ProfileUpdated', status, status, {}, true)
    })
    return resultFor(id)
  }

  async function createHospital(input, actor, key, password) {
    const id = await operationId(actor, key)
    const fingerprint = await hash(
      JSON.stringify({ action: 'createHospital', input }),
    )
    const targetUid = `hospital-${id.slice(0, 48)}`
    const hospitalId = input.hospitalId || `hospital-${id.slice(0, 24)}`
    await store.transact(async (tx) => {
      const existing = await existingOperation(tx, actor, id, fingerprint)
      if (existing) return
      const hospital = await tx.get('hospitals', hospitalId)
      const profile = await tx.get('users', targetUid)
      if (hospital || profile)
        throw new HttpError(
          409,
          'A facility or account with that id already exists.',
        )
      const at = now()
      const op = {
        action: 'createHospital',
        actorId: actor,
        targetUid,
        hospitalId,
        fingerprint,
        state: 'Pending',
        nextAttemptAt: at,
        createdAt: at,
        updatedAt: at,
        reason: 'Hospital account created by an administrator.',
      }
      tx.create(path(id), op)
      tx.create(`users/${targetUid}`, {
        role: 'hospital',
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.contactNumber,
        hospitalId,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
        geohash: input.geohash,
        status: 'Suspended',
        loginState: 'Provisioning',
        provisioningOperationId: id,
        createdAt: at,
        updatedAt: at,
      })
      tx.create(`hospitals/${hospitalId}`, {
        name: input.facilityName,
        address: input.address,
        contactNumber: input.contactNumber,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
        geohash: input.geohash,
        status: 'Suspended',
        provisioningOperationId: id,
        createdBy: actor,
        createdAt: at,
        updatedAt: at,
      })
    })
    await resume(id, password)
    return resultFor(id)
  }

  async function changeStatus(
    target,
    status,
    reason,
    actor,
    key,
    erase = false,
  ) {
    accountId(target)
    const note =
      status === 'Active' && !reason
        ? 'Account access restored by an administrator.'
        : reasonText(reason)
    if (!['Active', 'Suspended', 'Removed'].includes(status))
      throw new HttpError(400, 'Unknown account status.')
    const id = await operationId(actor, key)
    const fingerprint = await hash(
      JSON.stringify({
        action: erase ? 'erase' : 'status',
        target,
        status,
        reason: note,
      }),
    )
    const entityHash = erase ? await hash(target) : null
    await store.transact(async (tx) => {
      const existing = await existingOperation(tx, actor, id, fingerprint)
      if (existing) return
      const profile = await tx.get('users', target)
      assertTarget(profile, target, actor)
      const before = profile.data.status || 'Active'
      if (
        profile.data.loginState === 'Deleting' ||
        (!erase &&
          (profile.data.loginState === 'Deleted' ||
            profile.data.personalDataErased))
      )
        throw new HttpError(
          412,
          'This login is being deleted, permanently deleted, or its personal data was erased.',
        )
      if (
        !erase &&
        (before === status || (status === 'Suspended' && before !== 'Active'))
      )
        throw new HttpError(
          412,
          'That action does not apply to the current account status.',
        )
      if (status === 'Active' && !(await identity.get(target)))
        throw new HttpError(
          412,
          'This login has been permanently deleted or no longer exists.',
        )
      const redaction = erase
        ? await tx.get('auditRedactions', entityHash)
        : null
      const at = now()
      const op = {
        action: erase ? 'erase' : 'status',
        actorId: actor,
        targetUid: target,
        reason: note,
        fingerprint,
        createdAt: at,
      }
      tx.update(`users/${target}`, {
        status,
        statusReason: erase
          ? 'Personal data erased following a privacy request.'
          : status === 'Active'
            ? ''
            : note,
        statusUpdatedAt: at,
        updatedAt: at,
        ...(erase
          ? {
              fullName: 'Removed account',
              email: '',
              phoneNumber: '',
              city: '',
              geohash: '',
              latitude: 0,
              longitude: 0,
              bloodType: '',
              dateOfBirth: null,
              gender: '',
              personalDataErased: true,
            }
          : {}),
      })
      if (erase) {
        if (redaction)
          tx.update(`auditRedactions/${entityHash}`, {
            state: 'Pending',
            nextAttemptAt: at,
          })
        else
          tx.create(`auditRedactions/${entityHash}`, {
            state: 'Pending',
            nextAttemptAt: at,
            createdAt: at,
          })
        tx.delete(`donorLocations/${target}`)
      }
      const event = erase
        ? 'DataAccess.Erasure'
        : {
            Active: 'Account.Reactivated',
            Suspended: 'Account.Suspended',
            Removed: 'Account.Removed',
          }[status]
      finish(tx, id, op, event, before, status, {}, true)
    })
    return resultFor(id)
  }

  async function deleteLogin(target, reason, actor, key) {
    accountId(target)
    if (target === actor)
      throw new HttpError(412, 'You cannot delete your own sign-in account.')
    const note = reasonText(reason)
    const id = await operationId(actor, key)
    const fingerprint = await hash(
      JSON.stringify({ action: 'deleteLogin', target, reason: note }),
    )
    await store.transact(async (tx) => {
      const existing = await existingOperation(tx, actor, id, fingerprint)
      if (existing) return
      const profile = await tx.get('users', target)
      assertTarget(profile, target, actor)
      if (profile.data.status !== 'Removed')
        throw new HttpError(
          412,
          'Remove this account before permanently deleting its login.',
        )
      if (['Deleting', 'Deleted'].includes(profile.data.loginState))
        throw new HttpError(
          412,
          'This login is already being deleted or has been deleted.',
        )
      const at = now()
      tx.create(path(id), {
        action: 'deleteLogin',
        actorId: actor,
        targetUid: target,
        fingerprint,
        reason: note,
        state: 'Pending',
        nextAttemptAt: at,
        createdAt: at,
        updatedAt: at,
      })
      tx.update(`users/${target}`, {
        loginState: 'Deleting',
        accountOperationId: id,
        updatedAt: at,
      })
    })
    await resume(id)
    return resultFor(id)
  }

  async function resume(id, password) {
    const leaseToken = crypto.randomUUID()
    const op = await store.transact(async (tx) => {
      const doc = await tx.get('accountOperations', id)
      if (!doc || doc.data.state !== 'Pending' || doc.data.leaseUntil > now())
        return null
      const until = new Date(now().getTime() + 300000)
      tx.update(path(id), {
        leaseToken,
        leaseUntil: until,
        nextAttemptAt: until,
      })
      return doc.data
    })
    if (!op) return
    try {
      if (op.action === 'createHospital') {
        const profile = await store.get('users', op.targetUid)
        if (!profile || profile.data.provisioningOperationId !== id)
          throw new HttpError(
            412,
            'Provisioning records require administrator review.',
          )
        let login = await identity.get(op.targetUid)
        if (!login) {
          if (!password) {
            await defer(id, 'CredentialsRequired', leaseToken)
            return
          }
          try {
            await identity.create({
              uid: op.targetUid,
              email: profile.data.email,
              displayName: profile.data.fullName,
              password,
              emailVerified: true,
              disabled: true,
            })
          } catch (error) {
            // A concurrent retry can create the same reserved UID.
            login = await identity.get(op.targetUid)
            if (!login) {
              if ([400, 409].includes(error.status))
                await failProvisioning(id, op, error.message, leaseToken)
              throw error
            }
          }
          login = await identity.get(op.targetUid)
        }
        if (
          !login ||
          login.email?.toLowerCase() !== profile.data.email.toLowerCase()
        )
          throw new HttpError(
            412,
            'Provisioning identity requires administrator review.',
          )
        await assertLease(id, leaseToken)
        await identity.claims(op.targetUid, {
          role: 'staff',
          hospitalId: op.hospitalId,
        })
        await assertLease(id, leaseToken)
        await identity.enable(op.targetUid)
        await store.transact(async (tx) => {
          const fresh = await tx.get('accountOperations', id)
          if (
            fresh?.data.state !== 'Pending' ||
            fresh.data.leaseToken !== leaseToken
          )
            return
          const user = await tx.get('users', op.targetUid)
          const hospital = await tx.get('hospitals', op.hospitalId)
          if (
            user?.data.provisioningOperationId !== id ||
            hospital?.data.provisioningOperationId !== id
          )
            throw new HttpError(
              412,
              'Provisioning ownership changed; no records were overwritten.',
            )
          const at = now()
          tx.update(`users/${op.targetUid}`, {
            status: 'Active',
            loginState: 'Available',
            provisioningOperationId: null,
            updatedAt: at,
          })
          tx.update(`hospitals/${op.hospitalId}`, {
            status: 'Active',
            provisioningOperationId: null,
            updatedAt: at,
          })
          finish(tx, id, op, 'Account.HospitalCreated', '', 'Active', {
            hospitalId: op.hospitalId,
          })
        })
      } else if (op.action === 'deleteLogin') {
        await assertLease(id, leaseToken)
        await identity.delete(op.targetUid)
        await store.transact(async (tx) => {
          const fresh = await tx.get('accountOperations', id)
          if (
            fresh?.data.state !== 'Pending' ||
            fresh.data.leaseToken !== leaseToken
          )
            return
          const profile = await tx.get('users', op.targetUid)
          if (
            profile?.data.accountOperationId !== id ||
            profile.data.status !== 'Removed'
          )
            throw new HttpError(
              412,
              'Account state changed; completion requires administrator review.',
            )
          tx.update(`users/${op.targetUid}`, {
            loginState: 'Deleted',
            loginDeletedAt: now(),
            accountOperationId: null,
            updatedAt: now(),
          })
          finish(tx, id, op, 'Account.LoginDeleted', 'Removed', 'Removed')
        })
      }
    } catch (error) {
      await defer(id, 'RetryScheduled', leaseToken)
      if (error instanceof HttpError && error.status < 500) throw error
    }
  }

  async function assertLease(id, token) {
    const op = await store.get('accountOperations', id)
    if (
      op?.data.state !== 'Pending' ||
      op.data.leaseToken !== token ||
      op.data.leaseUntil <= now()
    )
      throw new HttpError(409, 'Another retry is processing this operation.')
  }

  async function defer(id, recoveryState, token) {
    await store.transact(async (tx) => {
      const op = await tx.get('accountOperations', id)
      if (op?.data.state === 'Pending' && op.data.leaseToken === token)
        tx.update(path(id), {
          recoveryState,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: new Date(now().getTime() + 60000),
          updatedAt: now(),
        })
    })
  }

  async function failProvisioning(id, op, message, token) {
    await store.transact(async (tx) => {
      const current = await tx.get('accountOperations', id)
      const user = await tx.get('users', op.targetUid)
      const hospital = await tx.get('hospitals', op.hospitalId)
      if (
        current?.data.state !== 'Pending' ||
        current.data.leaseToken !== token ||
        current.data.leaseUntil <= now()
      )
        return
      if (user?.data.provisioningOperationId === id)
        tx.delete(`users/${op.targetUid}`)
      if (hospital?.data.provisioningOperationId === id)
        tx.delete(`hospitals/${op.hospitalId}`)
      tx.update(path(id), {
        state: 'Failed',
        failureMessage: message,
        updatedAt: now(),
      })
    })
  }

  async function retryPending() {
    const operations = await store.query(dueQuery('accountOperations', now()))
    for (const operation of operations) {
      try {
        await resume(operation.id)
      } catch {
        /* The recovery record remains visible to the next run. */
      }
    }
    return { considered: operations.length }
  }

  return { createHospital, changeStatus, deleteLogin, retryPending, getProfile, editProfile }
}
