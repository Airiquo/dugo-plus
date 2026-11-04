import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextDonationStage, validCollectedUnits, canDeferDonation } from './donationProgress.js'
const row = stage => ({responseStatus:'Accepted',donor:{bloodType:'O+'},donationStage:stage})
test('only the immediate next step is actionable; completed/deferred/rejected and private/unaccepted rows have none', () => {
  assert.equal(nextDonationStage(row('Responded')),'Screened')
  assert.equal(nextDonationStage(row('Screened')),'Processing')
  assert.equal(nextDonationStage(row('Processing')),'Completed')
  for (const stage of ['Completed','Deferred','Rejected','Unknown']) assert.equal(nextDonationStage(row(stage)),null)
  assert.equal(nextDonationStage({...row('Processing'),donor:null}),null)
  assert.equal(nextDonationStage({...row('Processing'),responseStatus:'Pending'}),null)
})
test('deferral requires bounded nonblank text and an active consent-bearing attempt', () => {
  for(const stage of ['Responded','Screened','Processing']){
    assert(canDeferDonation(row(stage),' Medical screening deferred '))
    assert(!canDeferDonation(row(stage),'   '))
    assert(!canDeferDonation(row(stage),'x'.repeat(2001)))
  }
  assert(!canDeferDonation(row('Completed'),'Reason'))
  assert(!canDeferDonation(row('Deferred'),'Reason'))
})
test('completion requires actual positive safe integer units, including empty/fractional/overflow rejection', () => {
  for(const value of ['', ' ',0,-1,1.5,'1.1',Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert(!validCollectedUnits(value),String(value))
  for(const value of [1,'1',5,' 5 ',Number.MAX_SAFE_INTEGER])assert(validCollectedUnits(value))
})
