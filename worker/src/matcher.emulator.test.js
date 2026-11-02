import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { getDocument, runQuery, transactionStore } from './firestore.js'
import { processRequest, runMatchingCycle } from './matcher.js'
import { geohash } from '../../web/src/utils/geohash.js'

if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('Run only through the Firestore emulator.')

const project = 'demo-dugo-matching'
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
})
const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: project,
    client_email: 'matching-emulator@example.test',
    private_key: privateKey,
  }),
}
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(url)
  if (target.hostname === 'oauth2.googleapis.com')
    return Response.json({ access_token: 'emulator-owner', expires_in: 3600 })
  assert.equal(target.hostname, 'firestore.googleapis.com')
  assert.ok(target.pathname.startsWith(`/v1/projects/${project}/`))
  return originalFetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}${target.search}`,
    { ...init, headers: { ...init.headers, Authorization: 'Bearer owner' } },
  )
}
after(() => { globalThis.fetch = originalFetch })

const start = new Date('2026-11-02T06:00:00Z')
const at = (minutes) => new Date(start.getTime() + minutes * 60_000)
const store = transactionStore(env)
const requestData = (overrides = {}) => ({
  status: 'urgent', bloodType: 'B-', component: 'whole-blood',
  urgencyLevel: 'stat', createdBy: 'hospital', hospitalName: 'Test facility',
  latitude: 14.85883, longitude: 120.81647,
  geohash: geohash(14.85883, 120.81647), createdAt: start,
  ...overrides,
})
const donorData = (overrides = {}) => ({
  role: 'donor', status: 'Active', email: 'late-donor@example.test',
  bloodType: 'B-', dateOfBirth: new Date('1990-01-01'), city: 'Malolos',
  latitude: 14.864827, longitude: 120.818275,
  geohash: geohash(14.864827, 120.818275), createdAt: at(1),
  ...overrides,
})
const put = (path, data) => store.transact(async (tx) => { tx.create(path, data) })
const update = (path, data) => store.transact(async (tx) => { tx.update(path, data) })
const search = async (id, now) => processRequest(env, await getDocument(env, 'bloodRequests', id), { now })
const list = (collectionId) => runQuery(env, { from: [{ collectionId }] })

beforeEach(async () => {
  const response = await originalFetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  assert.ok(response.ok)
})

test('a donor created after the first search receives the open request before expansion is due', async () => {
  await put('bloodRequests/open', requestData())
  assert.equal((await search('open', start)).matched, 0)
  await put('users/late', donorData())

  const cycle = await runMatchingCycle(env, { now: at(1) })
  assert.equal(cycle.matched, 1)
  assert.equal(cycle.results[0].tier, 1)
  const request = await getDocument(env, 'bloodRequests', 'open')
  assert.equal(request.data.matching.nextTierAt.toISOString(), at(10).toISOString())
  assert.equal((await getDocument(env, 'notifications', 'open_late')).data.deliveryStatus, 'Pending')

  await update('donorMatches/open_late', { responseStatus: 'Declined' })
  await update('notifications/open_late', { readAt: at(1) })
  assert.equal((await runMatchingCycle(env, { now: at(2) })).matched, 0)
  assert.equal((await list('donorMatches')).length, 1)
  assert.equal((await list('notifications')).length, 1)
  assert.equal((await getDocument(env, 'donorMatches', 'open_late')).data.responseStatus, 'Declined')
  assert.equal((await getDocument(env, 'notifications', 'open_late')).data.readAt.toISOString(), at(1).toISOString())

  await runMatchingCycle(env, { now: at(10) })
  assert.equal((await getDocument(env, 'bloodRequests', 'open')).data.matching.currentTier, 2)
})

test('a completed radius ladder continues finding later donors at the maximum radius', async () => {
  await put('bloodRequests/exhausted', requestData({
    matching: { currentTier: 5, exhausted: true, nextTierAt: null, lastRunAt: start, matchedDonorCount: 0 },
  }))
  await put('users/late', donorData({ latitude: 14.97, geohash: geohash(14.97, 120.818275) }))
  const cycle = await runMatchingCycle(env, { now: at(100) })
  assert.equal(cycle.matched, 1)
  assert.equal(cycle.results[0].radiusKm, 25)
  const state = (await getDocument(env, 'bloodRequests', 'exhausted')).data.matching
  assert.equal(state.exhausted, true)
  assert.equal(state.nextTierAt, null)
  assert.equal(state.matchedDonorCount, 1)
})

test('profile completion makes a previously excluded donor matchable on a later search', async () => {
  await put('bloodRequests/open', requestData())
  await put('users/late', donorData({ dateOfBirth: null }))
  assert.equal((await search('open', start)).skipped.ineligible, 1)
  await update('users/late', { dateOfBirth: new Date('1990-01-01') })
  assert.equal((await runMatchingCycle(env, { now: at(1) })).matched, 1)
})

test('fulfilled, cancelled and matched requests do not recruit later donors', async () => {
  await put('users/late', donorData())
  for (const status of ['fulfilled', 'cancelled', 'matched']) {
    await put(`bloodRequests/${status}`, requestData({ status }))
    assert.equal((await search(status, at(1))).skipped, 'not-active')
  }
  assert.equal((await runMatchingCycle(env, { now: at(1) })).considered, 0)
  assert.equal((await list('donorMatches')).length, 0)
  assert.equal((await list('notifications')).length, 0)
})

test('pagination rotates searches beyond the first twenty active requests', async () => {
  await put('systemConfig/global', { radiusTiers: [{ radiusKm: 5, waitMinutes: 10 }] })
  for (let i = 0; i < 21; i++) {
    await put(`bloodRequests/request-${String(i).padStart(2, '0')}`, requestData({
      matching: { currentTier: 1, exhausted: true, nextTierAt: null, lastRunAt: start, matchedDonorCount: 0 },
    }))
  }
  const first = await runMatchingCycle(env, { now: at(1) })
  assert.equal(first.considered, 20)
  assert.equal(first.failed, 0)
  await put('users/late', donorData())
  const second = await runMatchingCycle(env, { now: at(2) })
  assert.equal(second.failed, 0)
  assert.ok(second.results.some((result) => result.requestId === 'request-20'))
  assert.ok(await getDocument(env, 'donorMatches', 'request-20_late'))
})
