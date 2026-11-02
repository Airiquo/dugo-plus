/**
 * Privileged account operations (FR-040) on the matching Worker.
 *
 * Mirrors `workers/account-service/lib/actions.js` and `functions/index.js`
 * against Google REST APIs, because the Worker cannot run `firebase-admin`.
 * The `POST /accounts` route calls these after gating on the caller's
 * `role: 'admin'` custom claim.
 */

import { HttpError } from './http.js'
import { getDocument, runQuery, transactionStore } from './firestore.js'
import {
  createUser,
  deleteUser,
  enableUser,
  getUser,
  setCustomUserClaims,
} from './identitytoolkit.js'
import { createAccountManager } from './accountOperations.js'
import { deliverAuditOutbox, hashRef } from './audit.js'
import { geohash, isCoordinate } from '../../web/src/utils/geohash.js'

const HOSPITAL_ID = /^[a-z0-9][a-z0-9-]{2,59}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** `users.role` -> the claim `firestore.rules` checks (D15/D26). */
const CLAIM_ROLE = { donor: 'donor', hospital: 'staff', admin: 'admin' }

function text(value, field, { required = true, max = 200 } = {}) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (required && !trimmed) throw new HttpError(400, `${field} is required.`)
  if (trimmed.length > max) {
    throw new HttpError(400, `${field} must be ${max} characters or fewer.`)
  }
  return trimmed
}

function coordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * The claims to publish for a `users/{uid}` profile, or null when the role is
 * not one the rules know.
 *
 * @param {Record<string, unknown>} data
 * @returns {Record<string, string> | null}
 */
export function claimsForUser(data) {
  const role = CLAIM_ROLE[data?.role]
  if (!role) return null
  const claims = { role }
  if (data.hospitalId) claims.hospitalId = data.hospitalId
  return claims
}

/**
 * Create a hospital account: sign-in record, `users/{uid}`,
 * `hospitals/{hospitalId}` and the `role: 'staff'` + `hospitalId` claims.
 *
 * @param {Record<string, unknown>} input
 * @param {string} [actorUid] the admin whose call this is
 * @returns {Promise<{ uid: string, hospitalId: string }>}
 */
export async function createHospitalAccount(env, input, actorUid) {
  const payload = input ?? {}

  const email = text(payload.email, 'Email', { max: 254 }).toLowerCase()
  if (!EMAIL.test(email))
    throw new HttpError(400, 'Enter a valid email address.')
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'The temporary password must be 8-128 characters.')
  }

  const fullName = text(payload.fullName, 'Contact name', { max: 120 })
  const facilityName = text(payload.facilityName, 'Facility name', { max: 160 })
  const address = text(payload.address, 'Address', { max: 240 })
  const contactNumber = text(payload.contactNumber, 'Contact number', {
    max: 40,
  })
  const city = text(payload.city, 'City', { required: false, max: 120 })

  for (const value of [payload.latitude, payload.longitude]) {
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new HttpError(400, 'Coordinates must be finite numbers.')
  }
  const latitude = coordinate(payload.latitude)
  const longitude = coordinate(payload.longitude)
  if ((latitude === null) !== (longitude === null)) {
    throw new HttpError(400, 'Give both coordinates, or neither.')
  }
  if (latitude !== null && !isCoordinate(latitude, longitude)) {
    throw new HttpError(400, 'Those coordinates are out of range.')
  }
  const hasPoint = latitude !== null && longitude !== null

  const requestedId = text(payload.hospitalId, 'Facility id', {
    required: false,
    max: 60,
  })
  if (requestedId && !HOSPITAL_ID.test(requestedId)) {
    throw new HttpError(
      400,
      'Facility id must be lowercase letters, numbers and dashes (3-60 characters).',
    )
  }

  return manager(env).createHospital(
    {
      email,
      fullName,
      facilityName,
      address,
      contactNumber,
      city,
      hospitalId: requestedId,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      geohash: hasPoint ? geohash(latitude, longitude) : '',
    },
    actorUid,
    payload.operationId,
    password,
  )
}

/** Delete a removed account's login through a recoverable operation. */
export async function deleteAuthAccount(
  env,
  uid,
  actorUid,
  reason,
  operationId,
) {
  if (uid === actorUid)
    throw new HttpError(412, 'You cannot delete your own sign-in account.')
  return manager(env).deleteLogin(uid, reason, actorUid, operationId)
}

/** Change account access and queue its audit event in one transaction. */
export async function updateAccountStatus(env, input, actorUid) {
  return manager(env).changeStatus(
    input.uid,
    input.status,
    input.reason,
    actorUid,
    input.operationId,
  )
}

/** Read the current editable profile and its concurrency revision. */
export async function getAccountProfile(env, uid, actorUid) {
  return manager(env).getProfile(uid, actorUid)
}

/** Save allowed profile/facility fields with a transactional audit event. */
export async function updateAccountProfile(env, input, actorUid) {
  const { uid, revision, profile, facility, reason } = input
  return manager(env).editProfile({ uid, revision, profile, facility, reason }, actorUid, input.operationId)
}

/** Erase profile details and queue context redaction with the account event. */
export async function eraseAccountData(env, input, actorUid) {
  return manager(env).changeStatus(
    input.uid,
    'Removed',
    input.reason,
    actorUid,
    input.operationId,
    true,
  )
}

/** Resume a bounded page of interrupted account operations. */
export async function retryAccountOperations(env) {
  return manager(env).retryPending()
}

function manager(env) {
  if (!env.AUDIT_HASH_SECRET)
    throw new HttpError(503, 'Account changes are temporarily unavailable.')
  return createAccountManager({
    store: transactionStore(env),
    hash: (value) => hashRef(env, value),
    identity: {
      get: (uid) => getUser(env, uid),
      create: (input) => createUser(env, input),
      claims: (uid, claims) => setCustomUserClaims(env, uid, claims),
      enable: (uid) => enableUser(env, uid),
      delete: (uid) => deleteUser(env, uid),
    },
    deliver: (id) => deliverAuditOutbox(env, id),
  })
}

/**
 * Publish Firebase Auth claims from `users/{uid}` (D15/D26), for one account or
 * every account.
 *
 * @param {string} [targetUid] one account; omitted means every account
 * @returns {Promise<{ updated: number, skipped: string[] }>}
 */
export async function setClaims(env, targetUid) {
  /** @type {Array<[string, Record<string, unknown>]>} */
  let entries

  if (targetUid) {
    const requested = text(targetUid, 'Account id', { max: 128 })
    const doc = await getDocument(env, 'users', requested)
    if (!doc) throw new HttpError(404, 'No profile exists for that account.')
    entries = [[requested, doc.data ?? {}]]
  } else {
    const docs = await runQuery(env, { from: [{ collectionId: 'users' }] })
    entries = docs.map((doc) => [doc.id, doc.data ?? {}])
  }

  let updated = 0
  const skipped = []
  for (const [uid, data] of entries) {
    const claims =
      (data.status && data.status !== 'Active') ||
      ['Provisioning', 'Deleting', 'Deleted'].includes(data.loginState)
        ? null
        : claimsForUser(data)
    if (!claims) {
      skipped.push(uid)
      continue
    }
    await setCustomUserClaims(env, uid, claims)
    updated += 1
  }
  return { updated, skipped }
}
