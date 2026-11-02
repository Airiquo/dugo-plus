import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccountManager } from './accountOperations.js'
import {
  hashRef,
  appendAuditBlockSimple,
  computeRecordHash,
  redactAuditContexts,
} from './audit.js'
import { memoryStore } from './testing/memoryStore.js'

const env = {
  AUDIT_HASH_SECRET: 'test-only',
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: 'demo-dugo',
    client_email: 'test',
    private_key: 'unused',
  }),
}
const input = {
  email: 'clinic@example.test',
  fullName: 'Contact',
  facilityName: 'Clinic',
  hospitalId: 'clinic-one',
  address: 'Test address',
  contactNumber: '123',
  city: 'Test City',
  latitude: 0,
  longitude: 0,
  geohash: '',
}
const key = '12345678-1234-1234-1234-123456789012'
function setup(extra = {}) {
  const store = memoryStore({
    'users/admin': { role: 'admin', status: 'Active' },
    'users/donor': { role: 'donor', status: 'Active', fullName: 'Donor' },
    ...extra,
  })
  const logins = new Map()
  const calls = []
  const identity = {
    get: async (uid) => logins.get(uid) || null,
    create: async (data) => {
      calls.push(['create', data])
      logins.set(data.uid, { email: data.email, disabled: true })
    },
    claims: async (uid, claims) => {
      calls.push(['claims', uid])
      logins.get(uid).claims = claims
    },
    enable: async (uid) => {
      calls.push(['enable', uid])
      logins.get(uid).disabled = false
    },
    delete: async (uid) => {
      calls.push(['delete', uid])
      logins.delete(uid)
    },
  }
  let time = new Date('2026-11-01T00:00:00Z')
  let deliveryFails = false
  const manager = createAccountManager({
    store,
    identity,
    hash: (value) => hashRef(env, value),
    now: () => time,
    deliver: async (id) => {
      if (deliveryFails) throw new Error('offline')
      return appendAuditBlockSimple(
        env,
        { ...store.docs.get(`auditOutbox/${id}`), outboxId: id },
        store,
      )
    },
  })
  return {
    manager,
    store,
    identity,
    calls,
    logins,
    advance: () => {
      time = new Date(time.getTime() + 360000)
    },
    failDelivery: () => {
      deliveryFails = true
    },
  }
}
const records = (store, collection) =>
  [...store.docs].filter(
    ([path]) => path.startsWith(collection + '/') && !path.endsWith('/_meta'),
  )

test('hospital activation records one event, with a disabled login until claims exist', async () => {
  const { manager, store, logins, calls } = setup()
  const result = await manager.createHospital(
    input,
    'admin',
    key,
    'secret-password',
  )
  assert.equal(result.state, 'Completed')
  assert.equal(result.auditRecorded, true)
  assert.equal(store.docs.get(`users/${result.uid}`).status, 'Active')
  assert.equal(logins.get(result.uid).disabled, false)
  assert.deepEqual(
    calls.map((call) => call[0]),
    ['create', 'claims', 'enable'],
  )
  assert.equal(calls[0][1].disabled, true)
  const again = await manager.createHospital(
    input,
    'admin',
    key,
    'secret-password',
  )
  assert.equal(again.uid, result.uid)
  assert.equal(records(store, 'auditBlocks').length, 1)
  assert.equal(calls.filter((call) => call[0] === 'create').length, 1)
  assert.ok(!JSON.stringify([...store.docs]).includes('secret-password'))
})

test('conflicting facility creation cannot delete the winner records', async () => {
  const { manager, store } = setup()
  const settled = await Promise.allSettled([
    manager.createHospital(input, 'admin', key, 'password'),
    manager.createHospital(
      { ...input, email: 'other@example.test' },
      'admin',
      key.replace('123456789012', '123456789013'),
      'password',
    ),
  ])
  assert.equal(
    settled.filter((result) => result.status === 'fulfilled').length,
    1,
  )
  assert.equal(store.docs.get('hospitals/clinic-one').status, 'Active')
  assert.equal(records(store, 'auditBlocks').length, 1)
})

test('a claims failure is recoverable by cron without storing credentials', async () => {
  const state = setup()
  const original = state.identity.claims
  state.identity.claims = async () => {
    throw new Error('temporary outage')
  }
  const first = await state.manager.createHospital(
    input,
    'admin',
    key,
    'password',
  )
  assert.equal(first.state, 'Pending')
  assert.equal(state.logins.values().next().value.disabled, true)
  state.identity.claims = original
  state.advance()
  await state.manager.retryPending()
  const completed = await state.manager.createHospital(
    input,
    'admin',
    key,
    'password',
  )
  assert.equal(completed.state, 'Completed')
  assert.equal(state.calls.filter((call) => call[0] === 'create').length, 1)
})

test('a lost Auth create response is recovered using the reserved UID', async () => {
  const state = setup()
  const create = state.identity.create
  state.identity.create = async (data) => {
    await create(data)
    throw new Error('response lost')
  }
  assert.equal(
    (await state.manager.createHospital(input, 'admin', key, 'password')).state,
    'Completed',
  )
  assert.equal(state.logins.size, 1)
})

test('definitive Auth rejection releases only records owned by that operation', async () => {
  const state = setup()
  state.identity.create = async () => {
    throw Object.assign(new Error('Email already exists.'), { status: 409 })
  }
  await assert.rejects(
    () => state.manager.createHospital(input, 'admin', key, 'password'),
    /Email already/,
  )
  assert.equal(state.store.docs.has('hospitals/clinic-one'), false)
  assert.equal(records(state.store, 'users').length, 2)
  assert.equal(records(state.store, 'auditBlocks').length, 0)
})

test('status and pending audit event commit atomically; duplicate retry creates no second event', async () => {
  const state = setup()
  state.failDelivery()
  const first = await state.manager.changeStatus(
    'donor',
    'Suspended',
    'Verification required',
    'admin',
    key,
  )
  assert.equal(first.auditState, 'Pending')
  assert.equal(state.store.docs.get('users/donor').status, 'Suspended')
  assert.equal(records(state.store, 'auditOutbox').length, 1)
  const event = records(state.store, 'auditOutbox')[0][1]
  assert.deepEqual(event.context, {
    reason: 'Verification required',
    beforeStatus: 'Active',
    afterStatus: 'Suspended',
  })
  assert.equal(event.actorId, 'admin')
  await state.manager.changeStatus(
    'donor',
    'Suspended',
    'Verification required',
    'admin',
    key,
  )
  assert.equal(records(state.store, 'auditOutbox').length, 1)
})

test('failed transaction leaves both account status and event unchanged', async () => {
  const { store, manager } = setup()
  store.failNextCommit(new Error('Firestore unavailable'))
  await assert.rejects(
    () => manager.changeStatus('donor', 'Suspended', 'Check', 'admin', key),
    /unavailable/,
  )
  assert.equal(store.docs.get('users/donor').status, 'Active')
  assert.equal(records(store, 'auditOutbox').length, 0)
})

test('non-admin, suspended, and removed administrators cannot mutate accounts', async () => {
  for (const profile of [
    { role: 'donor', status: 'Active' },
    { role: 'admin', status: 'Suspended' },
    { role: 'admin', status: 'Removed' },
  ]) {
    const state = setup({ 'users/admin': profile })
    await assert.rejects(
      () =>
        state.manager.changeStatus('donor', 'Removed', 'Check', 'admin', key),
      /active administrator/,
    )
    assert.equal(state.store.docs.get('users/donor').status, 'Active')
  }
})

test('self/admin changes and invalid status transitions are rejected', async () => {
  const { manager } = setup({
    'users/other-admin': { role: 'admin', status: 'Active' },
    'users/removed': { role: 'donor', status: 'Removed' },
  })
  await assert.rejects(
    () => manager.changeStatus('admin', 'Removed', 'Check', 'admin', key),
    /own account/,
  )
  await assert.rejects(
    () => manager.changeStatus('other-admin', 'Removed', 'Check', 'admin', key),
    /Administrator accounts/,
  )
  await assert.rejects(
    () => manager.changeStatus('removed', 'Suspended', 'Check', 'admin', key),
    /does not apply/,
  )
  await assert.rejects(
    () => manager.deleteLogin('donor', 'Check', 'admin', key),
    /Remove this account/,
  )
  await assert.rejects(
    () => manager.deleteLogin('removed', '', 'admin', key),
    /reason/,
  )
})

test('reusing an operation ID with different data cannot change the target', async () => {
  const { manager, store } = setup()
  await manager.changeStatus('donor', 'Suspended', 'Check', 'admin', key)
  await assert.rejects(
    () => manager.changeStatus('donor', 'Removed', 'Other', 'admin', key),
    /different details/,
  )
  assert.equal(store.docs.get('users/donor').status, 'Suspended')
})

test('deletion recovers after Auth succeeds but the completion write fails', async () => {
  const state = setup({ 'users/removed': { role: 'donor', status: 'Removed' } })
  state.identity.delete = async (uid) => {
    state.logins.delete(uid)
    state.store.failNextCommit(new Error('lost commit'))
  }
  const first = await state.manager.deleteLogin(
    'removed',
    'Duplicate login',
    'admin',
    key,
  )
  assert.equal(first.state, 'Pending')
  assert.equal(state.store.docs.get('users/removed').loginState, 'Deleting')
  await assert.rejects(
    () =>
      state.manager.changeStatus(
        'removed',
        'Active',
        '',
        'admin',
        key.replace('123456789012', '123456789014'),
      ),
    /being deleted/,
  )
  state.identity.delete = async (uid) => state.logins.delete(uid)
  state.advance()
  await state.manager.retryPending()
  assert.equal(state.store.docs.get('users/removed').loginState, 'Deleted')
  await assert.rejects(
    () =>
      state.manager.changeStatus(
        'removed',
        'Active',
        '',
        'admin',
        key.replace('123456789012', '123456789014'),
      ),
    /permanently deleted/,
  )
  assert.equal(
    (
      await state.manager.deleteLogin(
        'removed',
        'Duplicate login',
        'admin',
        key,
      )
    ).state,
    'Completed',
  )
})

test('outbox acknowledgement prevents duplicate blocks even after concurrent deliveries', async () => {
  const state = setup()
  state.failDelivery()
  const result = await state.manager.changeStatus(
    'donor',
    'Removed',
    'Reason',
    'admin',
    key,
  )
  const params = {
    ...state.store.docs.get(`auditOutbox/${result.operationId}`),
    outboxId: result.operationId,
  }
  await Promise.all([
    appendAuditBlockSimple(env, params, state.store),
    appendAuditBlockSimple(env, params, state.store),
  ])
  assert.equal(records(state.store, 'auditBlocks').length, 1)
  assert.deepEqual(
    Object.keys(
      state.store.docs.get(`auditOutbox/${result.operationId}`),
    ).sort(),
    ['deliveredAt', 'recordHash', 'state'],
  )
  const block = records(state.store, 'auditBlocks')[0][1]
  assert.equal(await computeRecordHash(block), block.recordHash)
  assert.ok(!JSON.stringify(block).includes('Reason'))
  assert.ok(!JSON.stringify(block).includes('donor'))
  assert.equal(records(state.store, 'auditContexts')[0][1].reason, 'Reason')
})

test('erasure tombstone prevents new identifying detail and blocks later restoration', async () => {
  const state = setup({ 'donorLocations/donor': { latitude: 1 } })
  await state.manager.changeStatus(
    'donor',
    'Removed',
    'Privacy request with personal detail',
    'admin',
    key,
    true,
  )
  assert.equal(state.store.docs.get('users/donor').personalDataErased, true)
  assert.equal(state.store.docs.has('donorLocations/donor'), false)
  assert.equal(records(state.store, 'auditContexts').length, 0)
  assert.equal(records(state.store, 'auditRedactions').length, 1)
  await assert.rejects(
    () =>
      state.manager.changeStatus(
        'donor',
        'Active',
        '',
        'admin',
        key.replace('123456789012', '123456789014'),
      ),
    /personal data was erased/,
  )
})

test('a provisioning lease prevents overlapping Auth writes for the same operation', async () => {
  const state = setup()
  const create = state.identity.create
  let release
  const blocked = new Promise((resolve) => {
    release = resolve
  })
  let started
  const reachedCreate = new Promise((resolve) => {
    started = resolve
  })
  state.identity.create = async (data) => {
    started()
    await blocked
    return create(data)
  }
  const first = state.manager.createHospital(input, 'admin', key, 'password')
  await reachedCreate
  assert.equal(
    (await state.manager.createHospital(input, 'admin', key, 'password')).state,
    'Pending',
  )
  release()
  assert.equal((await first).state, 'Completed')
  assert.equal(state.calls.filter((call) => call[0] === 'create').length, 1)
})

test('erasure redacts more than one page of old contexts without deleting blocks', async () => {
  const state = setup()
  const entityHash = await hashRef(env, 'donor')
  for (let i = 0; i < 201; i++)
    state.store.docs.set(`auditContexts/context-${i}`, {
      hashedEntityRef: entityHash,
      hashedActorRef: 'other',
      reason: 'Private detail',
    })
  await state.manager.changeStatus(
    'donor',
    'Removed',
    'Erase data',
    'admin',
    key,
    true,
  )
  for (let i = 0; i < 3; i++)
    await redactAuditContexts(
      env,
      new Date('2026-11-02T00:00:00Z'),
      state.store,
    )
  assert.equal(records(state.store, 'auditContexts').length, 0)
  assert.equal(records(state.store, 'auditBlocks').length, 1)
  assert.equal(
    state.store.docs.get(`auditRedactions/${entityHash}`).state,
    'Completed',
  )
})

test('legacy removed profiles cannot be restored after their Auth record was deleted', async () => {
  const state = setup({ 'users/legacy': { role: 'donor', status: 'Removed' } })
  await assert.rejects(
    () => state.manager.changeStatus('legacy', 'Active', '', 'admin', key),
    /no longer exists/,
  )
  assert.equal(state.store.docs.get('users/legacy').status, 'Removed')
})

test('failed provisioning cleanup preserves a facility whose ownership changed', async () => {
  const state = setup()
  state.identity.create = async () => {
    state.store.docs.set('hospitals/clinic-one', {
      name: 'Other facility',
      status: 'Active',
      provisioningOperationId: 'different-operation',
    })
    throw Object.assign(new Error('Email already exists.'), { status: 409 })
  }
  await assert.rejects(
    () => state.manager.createHospital(input, 'admin', key, 'password'),
    /Email already/,
  )
  assert.equal(
    state.store.docs.get('hospitals/clinic-one').name,
    'Other facility',
  )
})
