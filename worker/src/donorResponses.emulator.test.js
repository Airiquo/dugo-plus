import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { transactionStore } from './firestore.js'
import {
  createDonorResponder,
  createDonorAlertReader,
} from './donorResponses.js'
import worker from './index.js'
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('Run only through the Firestore emulator.')
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
})
const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: 'demo-dugo-donor',
    client_email: 'emulator@example.test',
    private_key: privateKey,
  }),
  FIREBASE_API_KEY: 'emulator-key',
}
const original = globalThis.fetch
let failConsent = false
const claims = {
  localId: 'donor',
  emailVerified: true,
  customAttributes: '{"role":"donor"}',
}
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(url)
  if (target.hostname === 'oauth2.googleapis.com')
    return Response.json({ access_token: 'emulator-owner', expires_in: 3600 })
  if (target.hostname === 'identitytoolkit.googleapis.com') {
    const { idToken } = JSON.parse(init.body)
    if (idToken !== 'donor-token')
      return Response.json(
        { error: { message: 'INVALID_ID_TOKEN' } },
        { status: 400 },
      )
    return Response.json({ users: [claims] })
  }
  if (target.hostname === 'firestore.googleapis.com') {
    assert.match(target.pathname, /^\/v1\/projects\/demo-dugo-donor\//)
    if (
      failConsent &&
      target.pathname.endsWith(':commit') &&
      JSON.parse(init.body).writes.some((write) =>
        write.update?.name.includes('/donorConsents/'),
      )
    )
      throw new Error('Simulated consent commit failure')
    return original(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}${target.search}`,
      { ...init, headers: { ...init.headers, Authorization: 'Bearer owner' } },
    )
  }
  throw new Error(
    'Unexpected external request in isolated test: ' + target.hostname,
  )
}
const store = transactionStore(env),
  respond = createDonorResponder(store, () => new Date('2026-11-02'))
const input = (id) => ({
  matchId: id,
  responseStatus: 'Accepted',
  acknowledged: true,
  dataSharingConsent: true,
  screeningConsent: true,
})
async function seed(uid, ids, profile = {}) {
  await store.transact(async (tx) => {
    tx.create('users/' + uid, {
      role: 'donor',
      status: 'Active',
      fullName: 'Demo Donor',
      city: 'Malolos',
      bloodType: 'O+',
      dateOfBirth: new Date('1990-01-01'),
      ...profile,
    })
    for (const id of ids) {
      tx.create('bloodRequests/' + id, {
        hospitalId: 'hospital',
        status: 'collecting',
        component: 'whole-blood',
        bloodType: 'O+',
      })
      tx.create('donorMatches/' + id, {
        requestId: id,
        donorId: uid,
        responseStatus: 'Pending',
      })
    }
  })
}
test('REST acceptance rejects a donor with an incomplete profile without changing the match', async () => {
  await seed('incomplete-donor', ['incomplete-match'], { city: '' })
  await assert.rejects(
    respond('incomplete-donor', input('incomplete-match')),
    (error) => {
      assert.equal(error.status, 409)
      assert.match(error.message, /complete your donor profile/i)
      assert.match(error.message, /city/i)
      return true
    },
  )
  assert.equal(
    (await store.get('donorMatches', 'incomplete-match')).data.responseStatus,
    'Pending',
  )
  assert.equal(await store.get('donorCommitments', 'incomplete-donor'), null)
})
test('REST transactions serialize simultaneous acceptances and release after completion', async () => {
  await store.transact(async (tx) =>
    tx.create('donationTypes/whole-blood', { intervalDays: 56 }),
  )
  await seed('donor', ['race-one', 'race-two'])
  const results = await Promise.allSettled([
    respond('donor', input('race-one')),
    respond('donor', input('race-two')),
  ])
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
  const lock = await store.get('donorCommitments', 'donor')
  const loser = lock.data.matchId === 'race-one' ? 'race-two' : 'race-one'
  assert.equal(
    (await store.get('donorMatches', loser)).data.responseStatus,
    'Pending',
  )
  assert.ok(
    await store.get('donorConsents', lock.data.matchId + '_data-sharing'),
  )
  await store.transact(async (tx) =>
    tx.create('donations/' + lock.data.matchId, { donorId: 'donor' }),
  )
  await respond('donor', input(loser))
  assert.equal(
    (await store.get('donorCommitments', 'donor')).data.matchId,
    loser,
  )
})
test('commit failure leaves match, commitment and both consents untouched', async () => {
  await seed('rollback', ['rollback-match'])
  failConsent = true
  try {
    await assert.rejects(
      respond('rollback', input('rollback-match')),
      /consent commit failure/,
    )
  } finally {
    failConsent = false
  }
  assert.equal(
    (await store.get('donorMatches', 'rollback-match')).data.responseStatus,
    'Pending',
  )
  assert.equal(await store.get('donorCommitments', 'rollback'), null)
  assert.equal(
    await store.get('donorConsents', 'rollback-match_data-sharing'),
    null,
  )
})
test('owner-only alert reads preserve delivery state, while the route requires verified authentication', async () => {
  await store.transact(async (tx) => {
    tx.create('notifications/mine', { userId: 'donor', deliveryStatus: 'Sent' })
    tx.create('notifications/foreign', { userId: 'someone-else' })
  })
  const read = createDonorAlertReader(store)
  await assert.rejects(read('donor', ['mine', 'foreign']))
  assert.ok(!(await store.get('notifications', 'mine')).data.readAt)
  await read('donor', ['mine'])
  assert.ok((await store.get('notifications', 'mine')).data.readAt)
  assert.equal(
    (await store.get('notifications', 'mine')).data.deliveryStatus,
    'Sent',
  )
  const request = (token) =>
    new Request('https://worker.test/donor/respond', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input('race-one')),
    })
  assert.equal((await worker.fetch(request('invalid'), env)).status, 401)
  claims.emailVerified = false
  assert.equal((await worker.fetch(request('donor-token'), env)).status, 403)
  claims.emailVerified = true
})

test('withdrawal revokes both consents, clears coordinates and releases the next acceptance', async () => {
  await seed('withdraw-donor', ['withdraw-one', 'withdraw-two'])
  await respond('withdraw-donor', {
    ...input('withdraw-one'),
    location: { latitude: 14.8, longitude: 120.8 },
  })
  await respond('withdraw-donor', {
    matchId: 'withdraw-one',
    responseStatus: 'Declined',
  })
  assert.equal(
    (await store.get('donorMatches', 'withdraw-one')).data.donorLatitude,
    null,
  )
  assert.ok(
    (await store.get('donorConsents', 'withdraw-one_data-sharing')).data
      .revokedAt,
  )
  assert.ok(
    (await store.get('donorConsents', 'withdraw-one_screening')).data.revokedAt,
  )
  await respond('withdraw-donor', input('withdraw-two'))
  assert.equal(
    (await store.get('donorCommitments', 'withdraw-donor')).data.matchId,
    'withdraw-two',
  )
})
