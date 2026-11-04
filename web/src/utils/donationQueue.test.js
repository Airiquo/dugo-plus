import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingDonationRows, queueFilterFields, queueStatus } from './donationQueue.js'
import { filterRecords } from './recordFilters.js'
const row={id:'attempt',responseStatus:'Accepted',screeningStatus:'Cleared',guidelinesAcknowledged:true}
test('queue filters distinguish legacy screening, processing, and terminal attempts',()=>{
 const screened={...row}, processing={...row,id:'processing',donationStage:'Processing'}, deferred={...row,id:'deferred',screeningStatus:'Deferred',donationStage:'Deferred'}
 const filter=stage=>filterRecords([screened,processing,deferred],{donationStage:stage},{fields:queueFilterFields})
 assert.deepEqual(filter('Screened'),[screened]);assert.deepEqual(filter('Processing'),[processing]);assert.deepEqual(filter('Deferred'),[deferred]);assert.equal(queueStatus(processing).label,'Processing')
})
test('completion leaves the queue immediately, including before the history read arrives',()=>{
 const complete={...row,id:'complete',donationStage:'Completed'}
 assert.deepEqual(pendingDonationRows([row,complete],[]),[row]);assert.deepEqual(pendingDonationRows([row,complete],[{id:row.id}]),[])
 const oldFilter={donationStage:'Screened'}
 const updated={...row,donationStage:'Processing'}
 assert.deepEqual(filterRecords([updated],oldFilter,{fields:queueFilterFields}),[])
})
