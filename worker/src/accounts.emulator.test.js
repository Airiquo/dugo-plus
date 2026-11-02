/** REST-level account and audit checks against an isolated Firestore emulator. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import {
  createHospitalAccount,
  deleteAuthAccount,
  updateAccountStatus,
  eraseAccountData,
} from './accounts.js'
import {
  redactAuditContexts,
  hashRef,
  retryAuditOutbox,
  verifyAuditChain,
  appendAuditBlockSimple,
} from './audit.js'
import { transactionStore } from './firestore.js'
import worker from './index.js'

if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error(
    'Run through the Firestore emulator; production access is prohibited.',
  )
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
})
const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: 'demo-dugo-accounts',
    client_email: 'emulator@example.test',
    private_key: privateKey,
  }),
  AUDIT_HASH_SECRET: 'emulator-only',
  FIREBASE_API_KEY: 'emulator-only',
}
const realFetch = globalThis.fetch
const identities = new Map([
  [
    'rest-admin',
    {
      email: 'admin@example.test',
      customAttributes: '{"role":"admin"}',
      emailVerified: true,
    },
  ],
])
let failAudit = false
const capabilityToken = 'test-admin-token'
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(url)
  if (target.hostname === 'oauth2.googleapis.com')
    return Response.json({ access_token: 'emulator-owner', expires_in: 3600 })
  if (target.hostname === 'firestore.googleapis.com') {
    assert.match(target.pathname, /^\/v1\/projects\/demo-dugo-accounts\//)
    if (
      failAudit &&
      target.pathname.endsWith(':commit') &&
      JSON.parse(init.body).writes.some((write) =>
        write.update?.name.includes('/auditBlocks/'),
      )
    )
      throw new Error('Simulated audit outage')
    return realFetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}${target.search}`,
      { ...init, headers: { ...init.headers, Authorization: 'Bearer owner' } },
    )
  }
  if (target.hostname === 'identitytoolkit.googleapis.com') {
    const body = JSON.parse(init.body)
    if (body.idToken) {
      if (body.idToken === 'test-donor-token') return Response.json({ users: [{ localId: 'rest-donor', emailVerified: true, customAttributes: '{"role":"donor"}' }] })
      if (body.idToken !== capabilityToken)
        return Response.json(
          { error: { message: 'INVALID_ID_TOKEN' } },
          { status: 400 },
        )
      return Response.json({
        users: [{ localId: 'rest-admin', ...identities.get('rest-admin') }],
      })
    }
    assert.match(
      target.pathname,
      /^\/v1\/projects\/demo-dugo-accounts\/accounts/,
    )
    if (target.pathname.endsWith(':lookup'))
      return Response.json({
        users: body.localId
          .filter((uid) => identities.has(uid))
          .map((uid) => ({ localId: uid, ...identities.get(uid) })),
      })
    if (target.pathname.endsWith(':update')) {
      Object.assign(
        identities.get(body.localId),
        body.customAttributes
          ? { customAttributes: body.customAttributes }
          : { disabled: body.disableUser },
      )
      return Response.json({ localId: body.localId })
    }
    if (target.pathname.endsWith(':delete')) {
      identities.delete(body.localId)
      return Response.json({})
    }
    assert.equal(target.pathname.endsWith('/accounts'), true)
    if ([...identities.values()].some((user) => user.email === body.email))
      return Response.json(
        { error: { message: 'EMAIL_EXISTS' } },
        { status: 400 },
      )
    identities.set(body.localId, {
      email: body.email,
      disabled: body.disabled,
      emailVerified: true,
    })
    return Response.json({ localId: body.localId })
  }
  throw new Error(
    `External network prohibited in emulator checks: ${target.hostname}`,
  )
}
const store = transactionStore(env)
const key = () => crypto.randomUUID()
const input = {
  operationId: key(),
  email: 'rest-clinic@example.test',
  password: 'test-password-only',
  fullName: 'Test contact',
  facilityName: 'Test hospital',
  address: 'Test address',
  contactNumber: '123',
  hospitalId: 'rest-clinic',
}

await store.transact(async (tx) => {
  tx.create('users/rest-admin', {
    role: 'admin',
    status: 'Active',
    fullName: 'REST admin',
    email: 'admin@example.test',
  })
  tx.create('users/rest-donor', {
    role: 'donor',
    status: 'Active',
    fullName: 'REST donor',
    email: 'donor@example.test',
  })
})

test('actual REST transactions provision, audit, suspend, restore, and delete safely', async () => {
  const created = await createHospitalAccount(env, input, 'rest-admin')
  assert.equal(created.state, 'Completed')
  assert.equal(created.auditRecorded, true)
  assert.equal((await store.get('users', created.uid)).data.status, 'Active')
  assert.equal(identities.get(created.uid).disabled, false)
  assert.equal(
    (await createHospitalAccount(env, input, 'rest-admin')).uid,
    created.uid,
  )
  await updateAccountStatus(
    env,
    {
      uid: created.uid,
      status: 'Suspended',
      reason: 'Check facility documentation',
      operationId: key(),
    },
    'rest-admin',
  )
  await updateAccountStatus(
    env,
    { uid: created.uid, status: 'Active', operationId: key() },
    'rest-admin',
  )
  await updateAccountStatus(
    env,
    {
      uid: created.uid,
      status: 'Removed',
      reason: 'Duplicate facility login',
      operationId: key(),
    },
    'rest-admin',
  )
  await deleteAuthAccount(
    env,
    created.uid,
    'rest-admin',
    'Duplicate login confirmed',
    key(),
  )
  assert.equal(
    (await store.get('users', created.uid)).data.loginState,
    'Deleted',
  )
  assert.equal(identities.has(created.uid), false)
  await assert.rejects(
    () =>
      updateAccountStatus(
        env,
        { uid: created.uid, status: 'Active', operationId: key() },
        'rest-admin',
      ),
    /permanently deleted/,
  )
  assert.equal((await verifyAuditChain(env)).valid, true)
})

test('actual outbox survives delivery failure and concurrent retries produce one block', async () => {
  failAudit = true
  const result = await updateAccountStatus(
    env,
    {
      uid: 'rest-donor',
      status: 'Suspended',
      reason: 'Temporary verification',
      operationId: key(),
    },
    'rest-admin',
  )
  assert.equal(result.auditRecorded, false)
  assert.equal(
    (await store.get('users', 'rest-donor')).data.status,
    'Suspended',
  )
  failAudit = false
  await Promise.all([retryAuditOutbox(env), retryAuditOutbox(env)])
  assert.equal(
    (await store.get('auditOutbox', result.operationId)).data.state,
    'Delivered',
  )
  const blocks = await store.query({
    from: [{ collectionId: 'auditBlocks' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'eventType' },
        op: 'EQUAL',
        value: { stringValue: 'Account.Suspended' },
      },
    },
  })
  assert.equal(blocks.length, 2)
  assert.equal((await verifyAuditChain(env)).valid, true)
})

test('erasure removes saved context, retains a verifiable chain, and cannot be restored', async () => {
  await eraseAccountData(
    env,
    {
      uid: 'rest-donor',
      reason: 'Subject requested erasure',
      operationId: key(),
    },
    'rest-admin',
  )
  await redactAuditContexts(env)
  const erasedHash = await hashRef(env, 'rest-donor')
  const remaining = await store.query({
    from: [{ collectionId: 'auditContexts' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'hashedEntityRef' },
        op: 'EQUAL',
        value: { stringValue: erasedHash },
      },
    },
  })
  assert.equal(remaining.length, 0)
  assert.equal(
    (await store.get('users', 'rest-donor')).data.fullName,
    'Removed account',
  )
  assert.equal((await verifyAuditChain(env)).valid, true)
  await assert.rejects(
    () =>
      updateAccountStatus(
        env,
        { uid: 'rest-donor', status: 'Active', operationId: key() },
        'rest-admin',
      ),
    /personal data was erased/,
  )
})

test('HTTP admin routes reject suspended profiles and forged account-event appends', async () => {
  const request = (path, body) =>
    new Request(`https://worker.example.test${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${capabilityToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  assert.equal(
    (await worker.fetch(request('/accounts', { action: 'capabilities' }), env))
      .status,
    200,
  )
  assert.equal(
    (
      await worker.fetch(
        request('/audit/append', { eventType: 'Account.HospitalCreated' }),
        env,
      )
    ).status,
    400,
  )
  await store.transact(async (tx) => {
    await tx.get('users', 'rest-admin')
    tx.update('users/rest-admin', { status: 'Suspended' })
  })
  assert.equal(
    (await worker.fetch(request('/accounts', { action: 'capabilities' }), env))
      .status,
    403,
  )
  assert.equal(
    (await worker.fetch(request('/audit/verify', {}), env)).status,
    403,
  )
})

test('HTTP account history enforces authority and paginates only the selected account', async () => {
  const request = (query, token = capabilityToken) => new Request(`https://worker.example.test/accounts/history?${query}`, { headers: { Authorization: `Bearer ${token}` } })
  assert.equal((await worker.fetch(request('accountId=rest-donor'), env)).status, 403)
  await store.transact(async tx => {
    await tx.get('users', 'rest-admin')
    tx.update('users/rest-admin', { status: 'Active' })
    tx.create('users/history-donor', { role: 'donor', status: 'Active' })
  })
  assert.equal((await worker.fetch(request('accountId=history-donor', 'invalid-token'), env)).status, 401)
  assert.equal((await worker.fetch(request('accountId=history-donor', 'test-donor-token'), env)).status, 403)
  assert.equal((await worker.fetch(request('accountId=history-donor&before=-1'), env)).status, 400)
  for (let i = 0; i < 27; i++) await appendAuditBlockSimple(env, { eventType: 'Account.Suspended', entityType: 'user', entityId: 'history-donor', actorId: 'rest-admin', actorRole: 'admin', context: { reason: `History fixture ${i}`, beforeStatus: 'Active', afterStatus: 'Suspended' } })
  const response = await worker.fetch(request('accountId=history-donor'), env)
  assert.equal(response.status, 200)
  const first = await response.json()
  assert.equal(first.events.length, 25)
  assert.equal(first.events[0].actor.fullName, 'REST admin')
  assert.equal(first.events[0].contextState, 'verified')
  const second = await (await worker.fetch(request(`accountId=history-donor&before=${first.nextBefore}`), env)).json()
  assert.equal(second.events.length, 2)
  assert.equal(second.nextBefore, null)
  assert.ok(second.events.every(event => event.sequence < first.nextBefore))
  const erased = await (await worker.fetch(request('accountId=rest-donor'), env)).json()
  assert.ok(erased.events.length > 0)
  assert.ok(erased.events.every(event => event.context === null && event.contextState === 'redacted'))
})

test.after(() => {
  globalThis.fetch = realFetch
})
