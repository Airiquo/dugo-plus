import test from 'node:test'
import assert from 'node:assert/strict'
import { enrichRequest, canReacceptRequest, isActiveCommitment, requestDonorProfile } from './donorRequests.js'
import { responseLabel } from './donationCompletion.js'
const item = overrides => ({match:{responseStatus:'Declined'},request:{status:'collecting'},hospital:{status:'Active'},...overrides})
test('reacceptance excludes closed requests, inactive/missing facilities and terminal attempts',()=>{
  assert.equal(canReacceptRequest(item()),true)
  assert.equal(canReacceptRequest(item({match:{responseStatus:'Expired'}})),true)
  for(const value of [item({request:{status:'fulfilled'}}),item({hospital:null}),item({hospital:{status:'Suspended'}}),item({donated:true}),
    ...['Deferred','Rejected','Completed'].map(donationStage=>item({match:{responseStatus:'Declined',donationStage}}))]) assert.equal(canReacceptRequest(value),false)
})
test('terminal outcomes release the active view and withdrawal stays distinct from rejection',()=>{
  assert.equal(isActiveCommitment(item({match:{responseStatus:'Accepted',donationStage:'Processing'}})),true)
  assert.equal(isActiveCommitment(item({match:{responseStatus:'Accepted',screeningStatus:'Deferred'}})),false)
  assert.equal(responseLabel({responseStatus:'Declined',withdrawnAt:new Date()}),'Withdrew')
  assert.equal(responseLabel({responseStatus:'Declined'}),'Declined')
  assert.equal(responseLabel({responseStatus:'Accepted',screeningStatus:'Rejected'}),'Responded')
})
test('a newly completed donation updates the UI clock without replacing a newer profile clock',()=>{
  const old=new Date('2026-10-01'),fresh=new Date('2026-11-04')
  assert.deepEqual(requestDonorProfile({lastDonationAt:old},[{donorLastDonationAt:fresh}]).lastDonationAt,fresh)
  assert.deepEqual(requestDonorProfile({lastDonationAt:fresh},[{donorLastDonationAt:old}]).lastDonationAt,fresh)
})

test('distance filtering keeps the saved request pin when the hospital location changes', () => {
  const record = enrichRequest({ match: {}, request: { bloodType: 'AB-', component: 'platelets', latitude: 14.563846, longitude: 121.063156 }, hospital: { latitude: 14.852259, longitude: 120.866089 } }, { lat: 14.85871, lng: 120.815277 }, 'AB-')
  assert.ok(record.distance > 25 && record.distance < 50)
  assert.deepEqual(record.facility, { lat: 14.563846, lng: 121.063156 })
})
