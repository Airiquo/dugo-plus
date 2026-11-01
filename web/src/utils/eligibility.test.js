import test from 'node:test'
import assert from 'node:assert/strict'
import {
  WHOLE_BLOOD_INTERVAL_DAYS,
  eligibilityFor,
  nextEligibleDate,
} from './eligibility.js'

const now = new Date('2026-06-01T12:00:00Z')
const adult = new Date('1990-01-01T00:00:00Z')

function daysAgo(days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

test('the default deferral is D13 whole blood (56 days)', () => {
  assert.equal(WHOLE_BLOOD_INTERVAL_DAYS, 56)
  assert.equal(eligibilityFor({ dateOfBirth: adult, lastDonationAt: daysAgo(55) }, now).status, 'deferred')
  assert.equal(eligibilityFor({ dateOfBirth: adult, lastDonationAt: daysAgo(57) }, now).status, 'eligible')
})

test('per-component intervals change the deferral', () => {
  assert.equal(
    eligibilityFor({ dateOfBirth: adult, lastDonationAt: daysAgo(8), intervalDays: 7 }, now).status,
    'eligible',
  )
  assert.equal(
    eligibilityFor({ dateOfBirth: adult, lastDonationAt: daysAgo(6), intervalDays: 7 }, now).status,
    'deferred',
  )
  assert.equal(
    eligibilityFor({ dateOfBirth: adult, lastDonationAt: daysAgo(29), intervalDays: 28 }, now).status,
    'eligible',
  )
  assert.equal(
    eligibilityFor({ dateOfBirth: adult, lastDonationAt: daysAgo(111), intervalDays: 112 }, now).status,
    'deferred',
  )
})

test('age limits and missing dates still apply', () => {
  assert.equal(eligibilityFor({ dateOfBirth: new Date('2010-01-01') }, now).status, 'underage')
  assert.equal(eligibilityFor({ dateOfBirth: new Date('1950-01-01') }, now).status, 'overage')
  assert.equal(eligibilityFor({}, now).status, 'unknown')
})

test('nextEligibleDate accepts a component interval', () => {
  const last = new Date('2026-05-01T00:00:00Z')
  assert.equal(nextEligibleDate(last).toISOString(), '2026-06-26T00:00:00.000Z')
  assert.equal(nextEligibleDate(last, 7).toISOString(), '2026-05-08T00:00:00.000Z')
})
