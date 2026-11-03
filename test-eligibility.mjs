import assert from 'node:assert/strict'
import {
  DEFAULT_INTERVALS,
  daysBetween,
  eligibilityFor,
} from './web/src/utils/eligibility.js'

// Intervals per FR-024 to FR-027 (D13 defaults; donationTypes overrides on read)
assert.equal(DEFAULT_INTERVALS['whole-blood'], 56, 'FR-024: Whole Blood must be 56 days')
assert.equal(DEFAULT_INTERVALS['platelets'], 7, 'FR-025: Platelets must be 7 days')
assert.equal(DEFAULT_INTERVALS['plasma'], 28, 'FR-026: Plasma must be 28 days')
assert.equal(DEFAULT_INTERVALS['double-red-cells'], 112, 'FR-027: Double Red Cells must be 112 days')

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date('2026-11-01T12:00:00Z')
const dob = '1995-05-15' // eligible age

// The deferral clock for one component: `intervalDays` from its donationTypes row.
function check(component, intervalDays, daysAgo, expected) {
  const last = new Date(now.getTime() - daysAgo * DAY_MS)
  const res = eligibilityFor({ dateOfBirth: dob, lastDonationAt: last, intervalDays }, now)
  assert.equal(res.status, expected, `${component}: ${daysAgo} days must be ${expected}`)
  assert.equal(res.eligible, expected === 'eligible')
  assert.equal(
    daysBetween(now, res.nextEligibleOn),
    Math.max(0, intervalDays - daysAgo),
    `${component}: days left at ${daysAgo} days`,
  )
}

// Test 1: Whole Blood (56 days) - FR-024
check('whole-blood', DEFAULT_INTERVALS['whole-blood'], 55, 'deferred')
check('whole-blood', DEFAULT_INTERVALS['whole-blood'], 56, 'eligible')

// Test 2: Platelets (7 days) - FR-025
check('platelets', DEFAULT_INTERVALS['platelets'], 6, 'deferred')
check('platelets', DEFAULT_INTERVALS['platelets'], 7, 'eligible')

// Test 3: Plasma (28 days) - FR-026
check('plasma', DEFAULT_INTERVALS['plasma'], 27, 'deferred')
check('plasma', DEFAULT_INTERVALS['plasma'], 28, 'eligible')

// Test 4: Double Red Cells (112 days) - FR-027
check('double-red-cells', DEFAULT_INTERVALS['double-red-cells'], 111, 'deferred')
check('double-red-cells', DEFAULT_INTERVALS['double-red-cells'], 112, 'eligible')

// Test 5: unknown component uses the longest interval, never a shorter one
const unknownRes = eligibilityFor({ dateOfBirth: dob, lastDonationAt: new Date(now.getTime() - 111 * DAY_MS), intervalDays: null }, now)
assert.equal(unknownRes.status, 'deferred', 'null interval falls back to the longest (112d)')
assert.equal(eligibilityFor({ dateOfBirth: dob }, now).status, 'eligible', 'no donation on record is eligible')
assert.equal(eligibilityFor({}, now).status, 'unknown', 'missing dates cannot decide')

console.log('All eligibility checks passed: FR-024 (56d), FR-025 (7d), FR-026 (28d), FR-027 (112d)')
