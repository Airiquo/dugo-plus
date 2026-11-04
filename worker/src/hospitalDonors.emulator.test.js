import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { createHospitalDonors } from './hospitalDonors.js'
import { transactionStore, documentName } from './firestore.js'
import worker from './index.js'
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run against an isolated Firestore emulator.')
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { format: 'pem', type: 'pkcs8' }, publicKeyEncoding: { format: 'pem', type: 'spki' } })
const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'demo-dugo-directory', client_email: 'fixture@example.test', private_key: privateKey }), FIREBASE_API_KEY: 'fixture', ALLOWED_ORIGINS: 'https://fixture.test' }
const originalFetch = globalThis.fetch
let routeActor
// Provider calls stay local; Firestore uses real REST queries, cursors and transactions.
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(url)
  if (target.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'emulator-owner', expires_in: 3600 })
  if (target.hostname === 'identitytoolkit.googleapis.com') {
    if (JSON.parse(init.body).idToken !== 'staff-token') return Response.json({ error: { message: 'INVALID_ID_TOKEN' } }, { status: 400 })
    return Response.json({ users: [{ localId: routeActor.uid, emailVerified: true, customAttributes: JSON.stringify(routeActor.claims) }] })
  }
  if (target.hostname === 'firestore.googleapis.com') {
    assert.match(target.pathname, /^\/v1\/projects\/demo-dugo-directory\//)
    return originalFetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}${target.search}`, { ...init, headers: { ...init.headers, Authorization: 'Bearer owner' } })
  }
  throw new Error('Unexpected network: ' + target.hostname)
}
const store = transactionStore(env)
const read = createHospitalDonors(store, path => documentName(env, path))
const runId = randomUUID().slice(0, 8)
let sequence = 0
async function setup(count = 3, repeats = 1) {
  const prefix = 'directory-' + runId + '-' + (++sequence), hospitalId = prefix + '-hospital', uid = prefix + '-staff'
  const actor = { uid, claims: { role: 'staff', hospitalId } }
  await store.transact(tx => {
    tx.create('users/' + uid, { role: 'hospital', hospitalId, status: 'Active' })
    tx.create('hospitals/' + hospitalId, { status: 'Active' })
    for (let i = 0; i < count; i++) {
      const donorId = prefix + '-donor-' + String(i).padStart(3, '0')
      tx.create('users/' + donorId, { role: 'donor', status: 'Active', fullName: 'Fixture donor ' + i, email: 'fixture@example.test', bloodType: 'O-', city: 'Fixture city', latitude: 14.5, statusReason: 'private', dateOfBirth: new Date('1990-01-01') })
      for (let n = 0; n < (i === 0 ? repeats : 1); n++) {
        const matchId = donorId + '-visit-' + String(n).padStart(3, '0')
        tx.create('donations/' + matchId, { hospitalId, donorId, matchId, requestId: prefix + '-request', donationDate: new Date('2026-11-01'), units: 2, component: 'plasma', bloodType: 'O-', ...(n % 2 ? { status: 'Completed', completedAt: new Date('2026-11-01') } : { confirmedAt: new Date('2026-11-01') }) })
        tx.create('donorConsents/' + matchId + '_data-sharing', { donorId, matchId, consentType: 'Data Sharing', revokedAt: null })
      }
    }
    tx.create('donorMatches/' + prefix + '-accepted-only', { donorId: prefix + '-never-donated', hospitalId, responseStatus: 'Accepted' })
    tx.create('donorMatches/' + prefix + '-deferred-only', { donorId: prefix + '-deferred', hospitalId, responseStatus: 'Accepted', screeningStatus: 'Deferred' })
  })
  return { actor, hospitalId, uid, donorId: prefix + '-donor-000', matchId: prefix + '-donor-000-visit-000' }
}

test('directory excludes accepted/deferred matches and allowlists only consent-authorized identity', async () => {
  const f = await setup(), page = await read(f.actor, { hospitalId: f.hospitalId })
  assert.equal(page.rows.length, 3)
  assert.deepEqual(Object.keys(page.rows[0].donor).sort(), ['bloodType', 'city', 'email', 'fullName', 'phoneNumber'])
  assert.equal(JSON.stringify(page).includes('latitude'), false)
  assert.equal(JSON.stringify(page).includes('dateOfBirth'), false)
  assert.equal(page.nextCursor, null)
})

test('revoked, missing, mismatched consent and erased/inactive profiles cannot reveal identity', async () => {
  for (const patch of [{ revokedAt: new Date() }, { matchId: 'another' }, { donorId: 'another' }, { consentType: 'Screening' }, { revokedAt: 'invalid' }]) {
    const f = await setup(1)
    await store.transact(tx => tx.update('donorConsents/' + f.matchId + '_data-sharing', patch))
    assert.equal((await read(f.actor, { hospitalId: f.hospitalId })).rows[0].donor, null)
  }
  for (const patch of [{ status: 'Suspended' }, { status: 'Removed' }, { personalDataErased: true }]) {
    const f = await setup(1)
    await store.transact(tx => tx.update('users/' + f.donorId, patch))
    assert.equal((await read(f.actor, { hospitalId: f.hospitalId })).rows[0].donor, null)
    assert.equal((await read(f.actor, { hospitalId: f.hospitalId, donorId: f.donorId })).rows.length, 1)
  }
  const f = await setup(1)
  await store.transact(tx => tx.delete('donorConsents/' + f.matchId + '_data-sharing'))
  assert.equal((await read(f.actor, { hospitalId: f.hospitalId })).rows[0].donor, null)
})

test('claims, profile, active facility and exact hospital boundary are mandatory', async () => {
  const f = await setup(1), other = await setup(1)
  for (const actor of [null, { uid: f.uid, claims: { role: 'donor' } }, { uid: f.uid, claims: { role: 'admin' } }, { uid: f.uid, claims: { role: 'staff', hospitalId: other.hospitalId } }])
    await assert.rejects(read(actor, { hospitalId: f.hospitalId }), { status: actor ? 403 : 401 })
  await assert.rejects(read(f.actor, { hospitalId: other.hospitalId }), { status: 403 })
  assert.equal((await read(f.actor, { hospitalId: f.hospitalId, donorId: other.donorId })).rows.length, 0)
  await store.transact(tx => tx.update('users/' + f.uid, { status: 'Suspended' }))
  await assert.rejects(read(f.actor, { hospitalId: f.hospitalId }), { status: 403 })
  await store.transact(tx => tx.update('users/' + f.uid, { status: 'Active', personalDataErased: true }))
  await assert.rejects(read(f.actor, { hospitalId: f.hospitalId }), { status: 403 })
  await store.transact(tx => { tx.update('users/' + f.uid, { personalDataErased: false }); tx.update('hospitals/' + f.hospitalId, { status: 'Removed' }) })
  await assert.rejects(read(f.actor, { hospitalId: f.hospitalId }), { status: 403 })
})

test('directory skips repeated visits, pages unique donors exactly once, and never scans per donor', async () => {
  const f = await setup(35, 40), rows = [], seen = new Set()
  let after = null, calls = 0
  const measured = createHospitalDonors({ transact: work => store.transact(tx => work({ ...tx, query: query => { calls++; assert.ok(query.limit <= 26); return tx.query(query) } })) }, path => documentName(env, path))
  do {
    const previous = calls
    const page = await measured(f.actor, { hospitalId: f.hospitalId, after })
    assert.ok(calls - previous <= 4, 'fixed query bound independent of donor count')
    for (const row of page.rows) { assert.ok(!seen.has(row.id)); seen.add(row.id); rows.push(row) }
    after = page.nextCursor
  } while (after)
  assert.equal(rows.length, 35)
})

test('selected history traverses new and legacy completions without other donors, writes, or restocking', async () => {
  const f = await setup(3, 32), first = await read(f.actor, { hospitalId: f.hospitalId, donorId: f.donorId })
  const last = await read(f.actor, { hospitalId: f.hospitalId, donorId: f.donorId, after: first.nextCursor })
  assert.equal(first.rows.length, 25); assert.equal(last.rows.length, 7); assert.equal(last.nextCursor, null)
  const all = [...first.rows, ...last.rows]
  assert.equal(new Set(all.map(row => row.id)).size, 32)
  assert.ok(all.every(row => row.donorId === f.donorId && row.status === 'Completed' && row.units === 2))
  assert.ok(all.some(row => row.legacy)); assert.ok(all.some(row => !row.legacy))
  assert.equal(await store.get('hospitals/' + f.hospitalId + '/inventory', 'plasma_O-'), null)
  assert.equal((await store.get('users', f.donorId)).data.lastDonationAt, undefined)
})

test('HTTP endpoint authenticates and sends private no-store responses; malformed input fails safely', async () => {
  const f = await setup(1); routeActor = f.actor
  const request = (body, token = 'staff-token') => new Request('https://worker.test/hospital/donors', { method: 'POST', headers: { Authorization: 'Bearer ' + token, Origin: 'https://fixture.test' }, body: JSON.stringify(body) })
  assert.equal((await worker.fetch(request({ hospitalId: f.hospitalId }, 'invalid'), env)).status, 401)
  for (const body of [null, [], { hospitalId: '../users' }, { hospitalId: f.hospitalId, donorId: false }, { hospitalId: f.hospitalId, after: 'a/b' }]) assert.equal((await worker.fetch(request(body), env)).status, 400)
  const response = await worker.fetch(request({ hospitalId: f.hospitalId }), env)
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://fixture.test')
  assert.equal((await response.json()).rows.length, 1)
})
