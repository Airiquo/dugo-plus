import assert from 'node:assert/strict'
import {
  COMPONENT_INTERVAL_DAYS,
  deferralDaysForComponent,
  nextEligibleDate,
  eligibilityFor,
  componentEligibilityList,
} from './web/src/utils/eligibility.js'

// Intervals per FR-024 to FR-027
assert.equal(COMPONENT_INTERVAL_DAYS['whole-blood'], 56, 'FR-024: Whole Blood must be 56 days')
assert.equal(COMPONENT_INTERVAL_DAYS['platelets'], 7, 'FR-025: Platelets must be 7 days')
assert.equal(COMPONENT_INTERVAL_DAYS['plasma'], 28, 'FR-026: Plasma must be 28 days')
assert.equal(COMPONENT_INTERVAL_DAYS['double-red-cells'], 112, 'FR-027: Double Red Cells must be 112 days')

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date('2026-11-01T12:00:00Z')
const dob = '1995-05-15' // eligible age

// Test 1: Whole Blood (56 days) - FR-024
const wb55DaysAgo = new Date(now.getTime() - 55 * DAY_MS)
const resWb55 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: wb55DaysAgo }, now, { component: 'whole-blood' })
assert.equal(resWb55.status, 'deferred', '55 days since Whole Blood must be deferred')
assert.equal(resWb55.eligible, false)
assert.equal(resWb55.daysLeft, 1)

const wb56DaysAgo = new Date(now.getTime() - 56 * DAY_MS)
const resWb56 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: wb56DaysAgo }, now, { component: 'whole-blood' })
assert.equal(resWb56.status, 'eligible', '56 days since Whole Blood must be eligible')
assert.equal(resWb56.eligible, true)

// Test 2: Platelets (7 days) - FR-025
const plt6DaysAgo = new Date(now.getTime() - 6 * DAY_MS)
const resPlt6 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: plt6DaysAgo }, now, { component: 'platelets' })
assert.equal(resPlt6.status, 'deferred', '6 days since Platelets must be deferred')
assert.equal(resPlt6.daysLeft, 1)

const plt7DaysAgo = new Date(now.getTime() - 7 * DAY_MS)
const resPlt7 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: plt7DaysAgo }, now, { component: 'platelets' })
assert.equal(resPlt7.status, 'eligible', '7 days since Platelets must be eligible')
assert.equal(resPlt7.eligible, true)

// Test 3: Plasma (28 days) - FR-026
const plasma27DaysAgo = new Date(now.getTime() - 27 * DAY_MS)
const resPlasma27 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: plasma27DaysAgo }, now, { component: 'plasma' })
assert.equal(resPlasma27.status, 'deferred', '27 days since Plasma must be deferred')
assert.equal(resPlasma27.daysLeft, 1)

const plasma28DaysAgo = new Date(now.getTime() - 28 * DAY_MS)
const resPlasma28 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: plasma28DaysAgo }, now, { component: 'plasma' })
assert.equal(resPlasma28.status, 'eligible', '28 days since Plasma must be eligible')
assert.equal(resPlasma28.eligible, true)

// Test 4: Double Red Cells (112 days) - FR-027
const drc111DaysAgo = new Date(now.getTime() - 111 * DAY_MS)
const resDrc111 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: drc111DaysAgo }, now, { component: 'double-red-cells' })
assert.equal(resDrc111.status, 'deferred', '111 days since Double Red Cells must be deferred')
assert.equal(resDrc111.daysLeft, 1)

const drc112DaysAgo = new Date(now.getTime() - 112 * DAY_MS)
const resDrc112 = eligibilityFor({ dateOfBirth: dob, lastDonationAt: drc112DaysAgo }, now, { component: 'double-red-cells' })
assert.equal(resDrc112.status, 'eligible', '112 days since Double Red Cells must be eligible')
assert.equal(resDrc112.eligible, true)

// Test 4b: request components map to the right interval (rbc -> whole blood, cryo -> plasma)
assert.equal(deferralDaysForComponent('whole-blood'), 56, 'whole-blood -> 56')
assert.equal(deferralDaysForComponent('platelets'), 7, 'platelets -> 7')
assert.equal(deferralDaysForComponent('plasma'), 28, 'plasma -> 28')
assert.equal(deferralDaysForComponent('rbc'), 56, 'rbc -> whole blood 56')
assert.equal(deferralDaysForComponent('cryoprecipitate'), 28, 'cryoprecipitate -> plasma 28')
assert.equal(deferralDaysForComponent('unknown'), 56, 'unknown -> whole blood 56')

// Test 5: componentEligibilityList returns all 4 types
const list = componentEligibilityList({ dateOfBirth: dob, lastDonationAt: wb55DaysAgo }, now)
assert.equal(list.length, 4)
const listWb = list.find((i) => i.id === 'whole-blood')
const listPlt = list.find((i) => i.id === 'platelets')
assert.equal(listWb.status, 'deferred')
assert.equal(listPlt.status, 'eligible', 'Platelets (7d) is eligible after 55 days')

console.log('All eligibility checks passed: FR-024 (56d), FR-025 (7d), FR-026 (28d), FR-027 (112d)')
