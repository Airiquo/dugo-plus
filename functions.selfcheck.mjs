import assert from 'node:assert/strict'

/**
 * Inventory callables self-check — `npm run test:functions`.
 *
 * Runs `functions/index.js` against the Firestore emulator through each
 * handler's `.run()`: auth gate, reads-before-writes transaction, stock
 * guards, log entries and the reward/lastDonationAt writes (FR-034).
 */

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-dugo'
process.env.FIREBASE_CONFIG =
  process.env.FIREBASE_CONFIG ?? JSON.stringify({ projectId: 'demo-dugo' })

const { confirmDonation, recordTransfusion, adjustInventory, db } = await import(
  './functions/index.js'
)

const staff = (hospitalId) => ({ uid: 'staff1', token: { role: 'hospital', hospitalId } })
const admin = { uid: 'admin1', token: { role: 'admin' } }
const donor = { uid: 'd1', token: { role: 'donor' } }

/** Asserts a callable rejects with an `https` error code. */
async function rejects(label, fn, code) {
  let err = null
  try {
    await fn()
  } catch (error) {
    err = error
  }
  assert.ok(err, `${label}: expected ${code}, the call resolved`)
  assert.equal(err.code, code, `${label}: expected ${code}, got ${err.code} — ${err.message}`)
}

async function units(hospitalId, bloodType) {
  const snap = await db.doc(`hospitals/${hospitalId}/inventory/${bloodType}`).get()
  return snap.exists ? snap.data().unitsAvailable : null
}

// ---- fixture -------------------------------------------------------------
await db.doc('hospitals/h1/inventory/O+').set({
  bloodType: 'O+',
  unitsAvailable: 3,
  lastUpdated: new Date(),
})
await db.doc('users/d1').set({ fullName: 'Dana Donor', role: 'donor' })
await db.doc('bloodRequests/r1').set({
  hospitalId: 'h1',
  bloodType: 'O+',
  status: 'matched',
  quantity: 2,
})
// m1 has no hospitalId/bloodType of its own: the function derives them from
// the request, the way schema §2.5 matches are stored.
await db.doc('donorMatches/m1').set({
  requestId: 'r1',
  donorId: 'd1',
  screeningStatus: 'Cleared',
  guidelinesAcknowledged: true,
})
await db.doc('donorMatches/m2').set({
  requestId: 'r1',
  donorId: 'd1',
  screeningStatus: 'Deferred',
  guidelinesAcknowledged: true,
})
await db.doc('donorMatches/m3').set({
  requestId: 'r1',
  donorId: 'd1',
  screeningStatus: 'Cleared',
  guidelinesAcknowledged: true,
})
await db.doc('donorMatches/m4').set({
  requestId: 'r1',
  donorId: 'd1',
  screeningStatus: 'Cleared',
  guidelinesAcknowledged: true,
})

// ---- auth + authority ----------------------------------------------------
await rejects(
  'anonymous call',
  () => confirmDonation.run({ data: { matchId: 'm1', units: 1 } }),
  'unauthenticated',
)
await rejects(
  'donor role',
  () => adjustInventory.run({ auth: donor, data: { bloodType: 'O+', delta: 1, reason: 'x', changeType: 'ADJUSTMENT' } }),
  'permission-denied',
)
await rejects(
  'staff of another hospital',
  () => confirmDonation.run({ auth: staff('h2'), data: { matchId: 'm1', units: 1 } }),
  'permission-denied',
)
await rejects(
  'admin names no hospital',
  () => adjustInventory.run({ auth: admin, data: { bloodType: 'O+', delta: 1, reason: 'x', changeType: 'ADJUSTMENT' } }),
  'invalid-argument',
)

// ---- confirmDonation -----------------------------------------------------
await rejects(
  'cleared match, bad units',
  () => confirmDonation.run({ auth: staff('h1'), data: { matchId: 'm1', units: 0 } }),
  'invalid-argument',
)
await rejects(
  'deferred donor',
  () => confirmDonation.run({ auth: staff('h1'), data: { matchId: 'm2', units: 1 } }),
  'failed-precondition',
)

const confirmed = await confirmDonation.run({
  auth: staff('h1'),
  data: { matchId: 'm1', units: 2 },
})
assert.equal(confirmed.unitsAvailable, 5, 'confirmDonation: 3 + 2 units')
const donation = await db.doc('donations/m1').get()
assert.equal(donation.data().donorName, 'Dana Donor', 'donorName denormalised')
assert.equal(donation.data().bloodType, 'O+', 'bloodType derived from the request')
assert.equal(donation.data().hospitalId, 'h1', 'hospitalId derived from the request')
assert.ok(donation.data().lastDonationAt === undefined, 'donations carry no lastDonationAt')
assert.ok((await db.doc('users/d1').get()).data().lastDonationAt, 'lastDonationAt set (D14)')
assert.equal((await db.doc('rewardTransactions/m1').get()).data().points, 10, 'default points')
const logs = await db.collection('hospitals/h1/inventory/O+/logs').listDocuments()
assert.equal(logs.length, 1, 'one log entry per movement')

await rejects(
  'second confirmation',
  () => confirmDonation.run({ auth: staff('h1'), data: { matchId: 'm1', units: 1 } }),
  'already-exists',
)
assert.equal(await units('h1', 'O+'), 5, 'stock unchanged by the rejected repeat')

// ---- recordTransfusion ---------------------------------------------------
await rejects(
  'more units than on hand',
  () => recordTransfusion.run({ auth: staff('h1'), data: { bloodType: 'O+', units: 99 } }),
  'failed-precondition',
)
await rejects(
  'request blood type mismatch',
  () => recordTransfusion.run({ auth: staff('h1'), data: { bloodType: 'A+', units: 1, requestId: 'r1' } }),
  'invalid-argument',
)
const issued = await recordTransfusion.run({
  auth: staff('h1'),
  data: { bloodType: 'O+', units: 2, requestId: 'r1' },
})
assert.equal(issued.unitsAvailable, 3, '5 - 2 units')
assert.equal((await db.doc('bloodRequests/r1').get()).data().status, 'fulfilled', 'D24 status')

// ---- adjustInventory -----------------------------------------------------
await rejects(
  'adjustment below zero',
  () => adjustInventory.run({ auth: staff('h1'), data: { bloodType: 'O+', delta: -99, reason: 'stocktake', changeType: 'ADJUSTMENT' } }),
  'failed-precondition',
)
await rejects(
  'movement code outside the adjustment set',
  () => adjustInventory.run({ auth: staff('h1'), data: { bloodType: 'O+', delta: -1, reason: 'x', changeType: 'DONATION' } }),
  'invalid-argument',
)
await rejects(
  'adjustment without a reason',
  () => adjustInventory.run({ auth: staff('h1'), data: { bloodType: 'O+', delta: -1, reason: '  ', changeType: 'EXPIRED' } }),
  'invalid-argument',
)
await rejects(
  'staff reaching for another facility',
  () => adjustInventory.run({ auth: staff('h1'), data: { bloodType: 'O+', delta: 1, reason: 'x', changeType: 'ADJUSTMENT', hospitalId: 'h2' } }),
  'permission-denied',
)
const adjusted = await adjustInventory.run({
  auth: staff('h1'),
  data: { bloodType: 'O+', delta: -1, reason: 'Expired unit discarded', changeType: 'EXPIRED' },
})
assert.equal(adjusted.unitsAvailable, 2, '3 - 1 units')
const logRefs = await db.collection('hospitals/h1/inventory/O+/logs').listDocuments()
const logSnaps = await Promise.all(logRefs.map((ref) => ref.get()))
const expiredLog = logSnaps.find((snap) => snap.data()?.changeType === 'EXPIRED')
assert.ok(expiredLog, 'an EXPIRED entry reaches the audit log')
assert.equal(expiredLog.data().changeType, 'EXPIRED')
assert.equal(expiredLog.data().reason, 'Expired unit discarded', 'reason reaches the audit log')

const asAdmin = await adjustInventory.run({
  auth: admin,
  data: { bloodType: 'O+', delta: 1, reason: 'Recount', changeType: 'ADJUSTMENT', hospitalId: 'h1' },
})
assert.equal(asAdmin.unitsAvailable, 3, 'admin names its hospital in the payload')

console.log('functions self-check: all assertions passed');
