import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BLOOD_TYPES,
  compatibleDonorBloodTypes,
  distanceKm,
  donationTypeForComponent,
  geohashPrefixesForRadius,
  isCompatibleDonor,
  sortRequestsByUrgency,
} from './matching.js'

test('whole blood requires an exact ABO/Rh match', () => {
  for (const type of BLOOD_TYPES) {
    assert.deepEqual(compatibleDonorBloodTypes(type, 'whole-blood'), [type])
  }
  assert.equal(isCompatibleDonor('O-', 'O+', 'whole-blood'), false)
})

test('red cells use the full red-cell compatibility matrix', () => {
  assert.deepEqual(compatibleDonorBloodTypes('O-', 'rbc'), ['O-'])
  assert.deepEqual(compatibleDonorBloodTypes('O+', 'rbc'), ['O-', 'O+'])
  assert.deepEqual(compatibleDonorBloodTypes('A+', 'rbc'), ['O-', 'O+', 'A-', 'A+'])
  assert.deepEqual(compatibleDonorBloodTypes('AB+', 'rbc'), BLOOD_TYPES)
  assert.equal(isCompatibleDonor('AB-', 'O-', 'rbc'), true)
  assert.equal(isCompatibleDonor('AB-', 'AB+', 'rbc'), false)
})

test('plasma reverses ABO and ignores Rh', () => {
  assert.deepEqual(compatibleDonorBloodTypes('AB+', 'plasma'), ['AB-', 'AB+'])
  assert.deepEqual(compatibleDonorBloodTypes('A+', 'plasma'), ['A-', 'A+', 'AB-', 'AB+'])
  assert.deepEqual(compatibleDonorBloodTypes('O-', 'plasma'), BLOOD_TYPES)
  assert.equal(isCompatibleDonor('A+', 'O-', 'plasma'), false)
  assert.equal(isCompatibleDonor('A+', 'A-', 'plasma'), true)
})

test('platelets match ABO and ignore Rh', () => {
  assert.deepEqual(compatibleDonorBloodTypes('A+', 'platelets'), ['A-', 'A+'])
  assert.deepEqual(compatibleDonorBloodTypes('AB-', 'platelets'), ['AB-', 'AB+'])
  assert.equal(isCompatibleDonor('B+', 'B-', 'platelets'), true)
  assert.equal(isCompatibleDonor('B+', 'O-', 'platelets'), false)
})

test('cryoprecipitate follows plasma compatibility', () => {
  assert.deepEqual(
    compatibleDonorBloodTypes('B+', 'cryoprecipitate'),
    compatibleDonorBloodTypes('B+', 'plasma'),
  )
})

test('unknown components and blood types fail closed', () => {
  assert.deepEqual(compatibleDonorBloodTypes('O+', 'not-a-component'), [])
  assert.deepEqual(compatibleDonorBloodTypes('Z+', 'rbc'), [])
  assert.equal(donationTypeForComponent('not-a-component'), null)
})

test('request components map to the interval-bearing donation type', () => {
  assert.equal(donationTypeForComponent('whole-blood'), 'whole-blood')
  assert.equal(donationTypeForComponent('rbc'), 'whole-blood')
  assert.equal(donationTypeForComponent('platelets'), 'platelets')
  assert.equal(donationTypeForComponent('plasma'), 'plasma')
  assert.equal(donationTypeForComponent('cryoprecipitate'), 'plasma')
})

test('queue sorts urgency first, then oldest request first', () => {
  const requests = [
    { id: 'routine-old', urgencyLevel: 'routine', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'urgent-new', urgencyLevel: 'urgent', createdAt: '2026-01-03T00:00:00Z' },
    { id: 'urgent-old', urgencyLevel: 'urgent', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'stat', urgencyLevel: 'stat', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'unknown', createdAt: '2025-01-01T00:00:00Z' },
  ]
  assert.deepEqual(
    sortRequestsByUrgency(requests).map((request) => request.id),
    ['urgent-old', 'urgent-new', 'stat', 'routine-old', 'unknown'],
  )
  assert.equal(requests[0].id, 'routine-old', 'input array is not mutated')
})

test('distance returns kilometres and rejects bad coordinates', () => {
  const manila = { lat: 14.5995, lng: 120.9842 }
  const quezonCity = { lat: 14.676, lng: 121.0437 }
  const km = distanceKm(manila, quezonCity)
  assert.ok(km > 10 && km < 13, `expected ~11 km, got ${km}`)
  assert.equal(distanceKm(manila, manila), 0)
  assert.equal(distanceKm({ lat: 999, lng: 0 }, manila), null)
})

test('radius prefixes are unique geohash cells around the request point', () => {
  for (const radius of [5, 10, 15, 20, 25]) {
    const prefixes = geohashPrefixesForRadius(14.5995, 120.9842, radius)
    assert.ok(prefixes.length >= 1 && prefixes.length <= 9)
    assert.equal(new Set(prefixes).size, prefixes.length)
    assert.equal(prefixes[0].length, radius <= 10 ? 5 : 4)
  }
  assert.deepEqual(geohashPrefixesForRadius(14.5995, 120.9842, 0), [])
  assert.deepEqual(geohashPrefixesForRadius(999, 0, 5), [])
})
