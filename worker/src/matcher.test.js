import test from 'node:test'
import assert from 'node:assert/strict'
import { selectMatches } from './matcher.js'

const now = new Date('2026-06-01T12:00:00Z')

function daysAgo(days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function donor(id, overrides = {}) {
  return {
    id,
    data: {
      role: 'donor',
      status: 'Active',
      email: `${id}@example.test`,
      bloodType: 'O-',
      dateOfBirth: new Date('1990-01-01T00:00:00Z'),
      lastDonationAt: daysAgo(60),
      latitude: 14.6,
      longitude: 120.985,
      ...overrides,
    },
  }
}

const request = {
  id: 'request-1',
  bloodType: 'O+',
  component: 'rbc',
  createdBy: 'creator',
  latitude: 14.5995,
  longitude: 120.9842,
}

const base = {
  request,
  requestPoint: { lat: 14.5995, lng: 120.9842 },
  donationType: { id: 'whole-blood', intervalDays: 56 },
  tier: { number: 1, radiusKm: 5 },
  now,
}

test('selectMatches keeps compatible, eligible, in-range donors', () => {
  const donors = [
    donor('o-negative'),
    donor('o-positive', { bloodType: 'O+' }),
  ]
  const result = selectMatches({ ...base, donors })
  assert.deepEqual(result.matches.map((match) => match.donorId).sort(), ['o-negative', 'o-positive'])
  assert.equal(result.skipped.existing, 0)
  assert.equal(result.matches[0].donationTypeId, 'whole-blood')
  assert.equal(result.matches[0].component, 'rbc')
  assert.equal(result.matches[0].responseStatus, 'Pending')
  assert.equal(result.matches[0].guidelinesAcknowledged, false)
  assert.equal(result.matches[0].tier, 1)
  assert.ok(result.matches[0].distanceKm < 1)
  assert.equal(result.matches[0].matchedAt, now)
})

test('selectMatches records each exclusion reason', () => {
  const donors = [
    donor('existing'),
    donor('creator'),
    donor('inactive', { status: 'Inactive' }),
    donor('a-positive', { bloodType: 'A+' }),
    donor('no-email', { email: '' }),
    donor('no-location', { latitude: null, longitude: null, geohash: null }),
    donor('too-far', { latitude: 14.7, longitude: 121.0 }),
    donor('too-soon', { lastDonationAt: daysAgo(55) }),
  ]
  const result = selectMatches({
    ...base,
    donors,
    existingMatchIds: new Set(['existing']),
  })

  assert.deepEqual(result.matches, [])
  assert.deepEqual(result.skipped, {
    existing: 1,
    self: 1,
    inactive: 1,
    incompatible: 1,
    noEmail: 1,
    noLocation: 1,
    outOfRange: 1,
    ineligible: 1,
  })
})

test('selectMatches uses the donation type interval', () => {
  const recent = donor('recent', { lastDonationAt: daysAgo(10) })
  const wholeBlood = selectMatches({ ...base, donors: [recent] })
  assert.equal(wholeBlood.matches.length, 0)
  assert.equal(wholeBlood.skipped.ineligible, 1)

  const platelets = selectMatches({
    ...base,
    donors: [recent],
    donationType: { id: 'platelets', intervalDays: 7 },
  })
  assert.equal(platelets.matches.length, 1)
})

test('selectMatches falls back to a geohash centre when lat/lng are absent', () => {
  const donorWithHash = donor('hash-only', {
    latitude: null,
    longitude: null,
    geohash: 'wdw51j8',
  })
  const result = selectMatches({ ...base, donors: [donorWithHash] })
  assert.equal(result.matches.length, 1)
})

test('selectMatches ignores Rh for platelets', () => {
  const result = selectMatches({
    ...base,
    request: { ...request, bloodType: 'A+', component: 'platelets' },
    donors: [donor('a-negative', { bloodType: 'A-' })],
  })
  assert.equal(result.matches.length, 1)
})

test('selectMatches rejects plasma from an incompatible ABO group', () => {
  const result = selectMatches({
    ...base,
    request: { ...request, bloodType: 'A+', component: 'plasma' },
    donors: [donor('o-negative', { bloodType: 'O-' })],
  })
  assert.equal(result.matches.length, 0)
  assert.equal(result.skipped.incompatible, 1)
})
