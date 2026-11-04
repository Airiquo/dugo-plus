import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { transactionStore, documentName } from './firestore.js'
import { createHospitalRequestResponses } from './hospitalRequestResponses.js'
import worker from './index.js'
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through the Firestore emulator.')
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { format: 'pem', type: 'pkcs8' }, publicKeyEncoding: { format: 'pem', type: 'spki' } })
const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'demo-dugo-responses', client_email: 'emulator@example.test', private_key: privateKey }), FIREBASE_API_KEY: 'emulator-key', ALLOWED_ORIGINS: 'https://fixture.test' }
const originalFetch = globalThis.fetch
let routeActor
// Real Firestore REST transactions; OAuth/Identity never leave this test process.
globalThis.fetch = async (url, init = {}) => {
  const target = new URL(url)
  if (target.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'emulator-owner', expires_in: 3600 })
  if (target.hostname === 'identitytoolkit.googleapis.com') {
    if (JSON.parse(init.body).idToken !== 'staff-token') return Response.json({ error: { message: 'INVALID_ID_TOKEN' } }, { status: 400 })
    return Response.json({ users: [{ localId: routeActor.uid, emailVerified: true, customAttributes: JSON.stringify(routeActor.claims) }] })
  }
  if (target.hostname === 'firestore.googleapis.com') {
    assert.match(target.pathname, /^\/v1\/projects\/demo-dugo-responses\//)
    return originalFetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}${target.search}`, { ...init, headers: { ...init.headers, Authorization: 'Bearer owner' } })
  }
  throw new Error('Unexpected network request: ' + target.hostname)
}
const store = transactionStore(env)
const read = createHospitalRequestResponses(store, path => documentName(env, path))
let sequence = 0
async function setup(count = 3) {
  const prefix = 'case-' + (++sequence), hospitalId = prefix + '-h', uid = prefix + '-staff', requestId = prefix + '-request'
  const actor = { uid, claims: { role: 'staff', hospitalId } }
  await store.transact(async tx => {
    tx.create('users/' + uid, { role: 'hospital', hospitalId, status: 'Active' })
    tx.create('hospitals/' + hospitalId, { status: 'Active' })
    tx.create('bloodRequests/' + requestId, { hospitalId, status: 'collecting' })
    for (let i = 0; i < count; i++) {
      const donorId = prefix + '-donor-' + i, matchId = requestId + '_' + String(i).padStart(3, '0')
      tx.create('users/' + donorId, { role: 'donor', status: 'Active', fullName: 'Fictional donor ' + i, email: `donor${i}@example.test`, phoneNumber: '09171234567', bloodType: 'O-', city: 'Fixture city', dateOfBirth: new Date('1990-01-01'), latitude: 14.5, statusReason: 'private' })
      tx.create('donorMatches/' + matchId, { donorId, requestId, responseStatus: ['Accepted', 'Declined', 'Pending'][i % 3], matchedAt: new Date('2026-11-03'), screeningStatus: i === 0 ? 'Cleared' : null })
      tx.create('donorConsents/' + matchId + '_data-sharing', { donorId, matchId, consentType: 'Data Sharing', grantedAt: new Date(), revokedAt: null })
    }
  })
  return { actor, requestId, hospitalId, uid, firstMatch: requestId + '_000', firstDonor: prefix + '-donor-0' }
}

test('contacts require accepted response and active match-specific consent; fields are allowlisted', async () => {
  const f = await setup(), result = await read(f.actor, { requestId: f.requestId })
  assert.equal(result.rows.length, 3)
  assert.deepEqual(Object.keys(result.rows[0].donor).sort(), ['bloodType', 'city', 'email', 'fullName', 'phoneNumber'])
  assert.equal(result.rows[0].screeningStatus, 'Cleared')
  assert.equal(result.rows[0].matchedAt, '2026-11-03T00:00:00.000Z')
  assert.equal(result.rows[1].donor, null)
  assert.equal(result.rows[2].donor, null)
  assert.equal(JSON.stringify(result).includes(f.firstDonor), false)
  assert.equal((await store.get('donorMatches', f.firstMatch)).data.responseStatus, 'Accepted')
})

test('revoked, mismatched, missing and incomplete consent never reveal contacts', async () => {
  for (const change of [{ revokedAt: new Date() }, { donorId: 'another' }, { matchId: 'another' }, { consentType: 'Screening' }, { revokedAt: undefined }]) {
    const f = await setup(1)
    await store.transact(tx => tx.update('donorConsents/' + f.firstMatch + '_data-sharing', change.revokedAt === undefined && Object.hasOwn(change, 'revokedAt') ? { revokedAt: 'invalid' } : change))
    assert.equal((await read(f.actor, { requestId: f.requestId })).rows[0].donor, null)
  }
  const f = await setup(1)
  await store.transact(tx => tx.delete('donorConsents/' + f.firstMatch + '_data-sharing'))
  assert.equal((await read(f.actor, { requestId: f.requestId })).rows[0].donor, null)
})

test('removed, suspended, erased and missing donor profiles stay private', async () => {
  for (const change of [{ status: 'Removed' }, { status: 'Suspended' }, { personalDataErased: true }]) {
    const f = await setup(1)
    await store.transact(tx => tx.update('users/' + f.firstDonor, change))
    const row = (await read(f.actor, { requestId: f.requestId })).rows[0]
    assert.equal(row.donor, null); assert.equal(row.privacy, 'profile-unavailable')
  }
  const f = await setup(1)
  await store.transact(tx => tx.delete('users/' + f.firstDonor))
  assert.equal((await read(f.actor, { requestId: f.requestId })).rows[0].donor, null)
})

test('claims, profile and facility boundaries reject cross-hospital and inactive access', async () => {
  const f = await setup(1)
  for (const actor of [null, { uid: f.uid, claims: { role: 'donor' } }, { uid: f.uid, claims: { role: 'admin' } }, { uid: f.uid, claims: { role: 'staff', hospitalId: 'another' } }])
    await assert.rejects(read(actor, { requestId: f.requestId }), { status: actor ? 403 : 401 })
  await store.transact(tx => tx.create('bloodRequests/foreign-request', { hospitalId: 'another' }))
  await assert.rejects(read(f.actor, { requestId: 'foreign-request' }), { status: 403 })
  await store.transact(tx => tx.update('users/' + f.uid, { status: 'Suspended' }))
  await assert.rejects(read(f.actor, { requestId: f.requestId }), { status: 403 })
  await store.transact(tx => { tx.update('users/' + f.uid, { status: 'Active' }); tx.update('hospitals/' + f.hospitalId, { status: 'Removed' }) })
  await assert.rejects(read(f.actor, { requestId: f.requestId }), { status: 403 })
})

test('real query cursors cover every match once and filter pages without losing records', async () => {
  const f = await setup(32), first = await read(f.actor, { requestId: f.requestId })
  assert.equal(first.rows.length, 25); assert.ok(first.nextCursor)
  const last = await read(f.actor, { requestId: f.requestId, after: first.nextCursor })
  assert.equal(last.rows.length, 7); assert.equal(last.nextCursor, null)
  assert.equal(new Set([...first.rows, ...last.rows].map(row => row.id)).size, 32)
  const accepted = await read(f.actor, { requestId: f.requestId, status: 'Accepted' })
  assert.equal(accepted.rows.length, 11); assert.ok(accepted.rows.every(row => row.responseStatus === 'Accepted'))
  const empty = await read(f.actor, { requestId: f.requestId, status: 'Expired' })
  assert.equal(empty.rows.length, 0)
  await store.transact(tx => tx.update('bloodRequests/' + f.requestId, { status: 'fulfilled' }))
  assert.equal((await read(f.actor, { requestId: f.requestId })).rows.length, 25)
})

test('invalid input and missing requests fail with controlled errors', async () => {
  const f = await setup(0)
  for (const input of [{ requestId: '../users' }, { requestId: f.requestId, status: 'arbitrary' }, { requestId: f.requestId, after: 'x/y' }])
    await assert.rejects(read(f.actor, input), { status: 400 })
  await assert.rejects(read(f.actor, { requestId: 'missing' }), { status: 404 })
})

test('HTTP route authenticates, enforces scope, returns private no-store responses and CORS', async () => {
  const f = await setup(1); routeActor = f.actor
  const request = (token = 'staff-token') => new Request('https://worker.test/hospital/request-responses?requestId=' + f.requestId, { headers: { Authorization: 'Bearer ' + token, Origin: 'https://fixture.test' } })
  assert.equal((await worker.fetch(request('invalid'), env)).status, 401)
  routeActor = { ...f.actor, claims: { role: 'donor' } }
  assert.equal((await worker.fetch(request(), env)).status, 403)
  routeActor = f.actor
  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://fixture.test')
  assert.equal((await response.json()).rows[0].donor.fullName, 'Fictional donor 0')
})

test('response pages batch contacts and legacy completion with bounded queries rather than per-row reads', async () => {
  const f=await setup(32)
  await store.transact(tx=>{
    tx.create('donations/'+f.firstMatch,{hospitalId:f.hospitalId,donorId:f.firstDonor,confirmedAt:new Date('2026-11-03')})
    tx.update('donorMatches/'+f.requestId+'_001',{responseStatus:'Declined',withdrawnAt:new Date('2026-11-03')})
  })
  const calls=[]
  const bounded={transact:work=>store.transact(tx=>work({...tx,get:(...args)=>{calls.push(['get',...args]);return tx.get(...args)},query:q=>{calls.push(['query',q.limit]);return tx.query(q)}}))}
  const result=await createHospitalRequestResponses(bounded,path=>documentName(env,path))(f.actor,{requestId:f.requestId})
  assert.equal(result.rows[0].donationStage,'Completed')
  assert.equal(result.rows[1].responseLabel,'Withdrew')
  assert.equal(result.rows[1].donor,null)
  assert.equal(calls.filter(call=>call[0]==='get').length,3)
  assert.equal(calls.filter(call=>call[0]==='query').length,4)
  assert.ok(calls.filter(call=>call[0]==='query').every(call=>call[1]<=26))
})
