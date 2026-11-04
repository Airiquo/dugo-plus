import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createInventoryManager } from './inventoryOperations.js'
import { memoryStore } from './testing/memoryStore.js'

const actor = { uid: 'staff', claims: { role: 'staff', hospitalId: 'h1' } }
const hash = async value => createHash('sha256').update(value).digest('hex')
const at = new Date('2026-11-03T06:00:00Z')
const confirm = { action: 'confirmDonation', matchId: 'r1_donor', units: 2 }
const issue = { action: 'recordTransfusion', hospitalId: 'h1', bloodType: 'O-', component: 'rbc', units: 1, requestId: 'r1', operationId: '12345678-1234-1234-1234-123456789012' }
function setup(extra = {}) {
  const store = memoryStore({
    'users/staff': { role: 'hospital', hospitalId: 'h1', status: 'Active' },
    'users/admin': { role: 'admin', status: 'Active' },
    'users/donor': { role: 'donor', status: 'Active', bloodType: 'O-', dateOfBirth: new Date('1990-01-01') },
    'hospitals/h1': { status: 'Active' },
    'bloodRequests/r1': { hospitalId: 'h1', component: 'rbc', bloodType: 'A+', quantity: 3, status: 'collecting' },
    'donorMatches/r1_donor': { donorId: 'donor', requestId: 'r1', donationTypeId: 'whole-blood', responseStatus: 'Accepted', screeningStatus: 'Cleared', donationStage: 'Processing', guidelinesAcknowledged: true },
    'donorConsents/r1_donor_data-sharing': { donorId: 'donor', matchId: 'r1_donor', consentType: 'Data Sharing', revokedAt: null },
    'donorConsents/r1_donor_screening': { donorId: 'donor', matchId: 'r1_donor', consentType: 'Screening', revokedAt: null },
    'donationTypes/whole-blood': { intervalDays: 56 },
    ...extra,
  })
  return { store, execute: createInventoryManager({ store, hash, now: () => at }) }
}
const records = (store, prefix) => [...store.docs].filter(([path]) => path.startsWith(prefix + '/'))

test('confirmation atomically records the actual donor group/component, date, log and two durable events; concurrent retries are idempotent', async () => {
  const { store, execute } = setup({ 'hospitals/h1/inventory/O-': { bloodType: 'O-', unitsAvailable: 9 } })
  const results = await Promise.all([execute(actor, confirm), execute(actor, confirm)])
  assert.equal(results.filter(result => result.replayed).length, 1)
  assert.equal(store.docs.get('hospitals/h1/inventory/rbc_O-').unitsAvailable, 2)
  assert.equal(store.docs.get('hospitals/h1/inventory/O-').unitsAvailable, 9)
  assert.equal(store.docs.has('hospitals/h1/inventory/rbc_A+'), false)
  assert.equal(store.docs.get('donations/r1_donor').bloodType, 'O-')
  assert.equal(store.docs.get('donations/r1_donor').component, 'rbc')
  assert.deepEqual(store.docs.get('users/donor').lastDonationAt, at)
  assert.equal(records(store, 'auditOutbox').length, 2)
  assert.equal(records(store, 'inventoryOperations').length, 1)
  assert.equal(records(store, 'hospitals/h1/inventory/rbc_O-/logs').length, 1)
  await assert.rejects(execute(actor, { ...confirm, units: 3 }), { status: 409 })
})

test('facility, active-account and claims boundaries reject confirmation before writes', async () => {
  for (const invalid of [
    { uid: 'staff', claims: { role: 'staff', hospitalId: 'h2' } },
    { uid: 'donor', claims: { role: 'staff', hospitalId: 'h1' } },
    { uid: 'staff', claims: { role: 'donor' } },
    { uid: 'staff', claims: { role: 'admin' } },
  ]) {
    const { store, execute } = setup()
    await assert.rejects(execute(invalid, confirm), { status: 403 })
    assert.equal(records(store, 'donations').length, 0)
  }
  for (const extra of [
    { 'users/staff': { role: 'hospital', hospitalId: 'h1', status: 'Suspended' } },
    { 'hospitals/h1': { status: 'Removed' } },
    { 'bloodRequests/r1': { hospitalId: 'h2', status: 'collecting' } },
  ]) {
    const { store, execute } = setup(extra)
    await assert.rejects(execute(actor, confirm))
    assert.equal(records(store, 'inventoryOperations').length, 0)
  }
})

test('confirmation requires accepted consent, cleared screening, open request and a currently eligible donor', async () => {
  for (const extra of [
    { 'donorMatches/r1_donor': { donorId: 'donor', requestId: 'r1', responseStatus: 'Pending', screeningStatus: 'Cleared', guidelinesAcknowledged: true } },
    { 'donorMatches/r1_donor': { donorId: 'donor', requestId: 'r1', responseStatus: 'Accepted', screeningStatus: 'Deferred', guidelinesAcknowledged: true } },
    { 'donorMatches/r1_donor': { donorId: 'donor', requestId: 'r1', responseStatus: 'Accepted', screeningStatus: 'Cleared', guidelinesAcknowledged: false } },
    { 'bloodRequests/r1': { hospitalId: 'h1', status: 'cancelled', component: 'rbc', bloodType: 'A+' } },
    { 'users/donor': { role: 'donor', bloodType: 'O-', dateOfBirth: new Date('1990-01-01'), lastDonationAt: new Date('2026-11-01') } },
    { 'donorConsents/r1_donor_screening': { donorId: 'donor', matchId: 'r1_donor', consentType: 'Screening', revokedAt: new Date() } },
    { 'users/donor': { role: 'donor', bloodType: 'B+', dateOfBirth: new Date('1990-01-01') } },
  ]) {
    const { store, execute } = setup(extra)
    await assert.rejects(execute(actor, confirm), { status: 409 })
    assert.equal(records(store, 'auditOutbox').length, 0)
  }
})

test('a failed confirmation commit leaves donation, inventory, clock and audit unchanged', async () => {
  const { store, execute } = setup()
  const before = structuredClone([...store.docs])
  store.failNextCommit(new Error('commit unavailable'))
  await assert.rejects(execute(actor, confirm), /commit unavailable/)
  assert.deepEqual([...store.docs], before)
  await execute(actor, confirm)
  assert.equal(records(store, 'donations').length, 1)
})

test('transfusion consumes only matching component stock and fulfills only the complete quantity; retries do not issue twice', async () => {
  const { store, execute } = setup({
    'hospitals/h1/inventory/rbc_O-': { component: 'rbc', bloodType: 'O-', unitsAvailable: 4 },
    'hospitals/h1/inventory/plasma_O-': { component: 'plasma', bloodType: 'O-', unitsAvailable: 8 },
  })
  await execute(actor, issue)
  await execute(actor, issue)
  assert.equal(store.docs.get('bloodRequests/r1').status, 'collecting')
  assert.equal(store.docs.get('bloodRequests/r1').transfusedUnits, 1)
  assert.equal(store.docs.get('hospitals/h1/inventory/rbc_O-').unitsAvailable, 3)
  assert.equal(store.docs.get('hospitals/h1/inventory/plasma_O-').unitsAvailable, 8)
  await execute(actor, { ...issue, units: 2, operationId: '22345678-1234-1234-1234-123456789012' })
  assert.equal(store.docs.get('bloodRequests/r1').status, 'fulfilled')
  assert.equal(store.docs.get('bloodRequests/r1').transfusedUnits, 3)
  await assert.rejects(execute(actor, { ...issue, operationId: '32345678-1234-1234-1234-123456789012' }), { status: 409 })
})

test('adjustments require a reason and valid stock identity, prevent negative counts and audit exactly once', async () => {
  const { store, execute } = setup()
  const adjust = { action: 'adjustInventory', hospitalId: 'h1', bloodType: 'O-', component: 'plasma', delta: 3, reason: 'Verified stock count', changeType: 'ADJUSTMENT', operationId: issue.operationId }
  for (const overrides of [{reason:''}, {component:'unknown'}, {delta:0}, {delta:1,changeType:'EXPIRED'}])
    await assert.rejects(execute(actor,{...adjust,...overrides}),{status:400})
  await execute(actor, adjust)
  await execute(actor, adjust)
  assert.equal(store.docs.get('hospitals/h1/inventory/plasma_O-').unitsAvailable,3)
  assert.equal(records(store,'auditOutbox').length,1)
  await assert.rejects(execute(actor,{...adjust,delta:-4,operationId:'22345678-1234-1234-1234-123456789012'}),{status:409})
})

test('deferral needs a reason, is retry-safe and ends the attempt without stock or donation', async () => {
  const {store,execute}=setup({ 'donorCommitments/donor': { matchId: 'r1_donor' } })
  const screen={action:'screenMatch',matchId:'r1_donor',screeningStatus:'Deferred',reason:'Screening result requires deferral',operationId:issue.operationId}
  await assert.rejects(execute(actor,{...screen,reason:'  '}),{status:400})
  await execute(actor,screen)
  await execute(actor,screen)
  assert.equal(store.docs.get('donorMatches/r1_donor').screeningStatus,'Deferred')
  assert.equal(store.docs.get('donorMatches/r1_donor').deferralReason,screen.reason)
  assert.equal(store.docs.has('donorCommitments/donor'),false)
  assert.equal(records(store,'donations').length,0)
  assert.equal(records(store,'hospitals/h1/inventory').length,0)
  assert.equal(records(store,'auditOutbox').length,1)
  await assert.rejects(execute(actor,{...screen,screeningStatus:'Screened',operationId:'22345678-1234-1234-1234-123456789012'}),{status:409})
  await assert.rejects(execute(actor,confirm),{status:409})
})

test('screening and processing must be recorded in order; legacy Cleared maps to Screened', async () => {
  const { store, execute } = setup({ 'donorMatches/r1_donor': { donorId:'donor',requestId:'r1',responseStatus:'Accepted',guidelinesAcknowledged:true } })
  const screen = { action:'screenMatch',matchId:'r1_donor',screeningStatus:'Processing',operationId:issue.operationId }
  await assert.rejects(execute(actor, confirm), {status:409})
  await assert.rejects(execute(actor, screen), {status:409})
  await execute(actor,{...screen,screeningStatus:'Screened'})
  await execute(actor,{...screen,operationId:'22345678-1234-1234-1234-123456789012'})
  await execute(actor,confirm)
  assert.equal(store.docs.get('donorMatches/r1_donor').donationStage,'Completed')
  assert.equal(store.docs.get('donations/r1_donor').status,'Completed')
  assert.deepEqual(store.docs.get('donations/r1_donor').completedAt,at)
  assert.deepEqual(store.docs.get('donations/r1_donor').confirmedAt,at)
  const movement=records(store,'hospitals/h1/inventory/rbc_O-/logs')[0][1]
  assert.equal(movement.requestId,'r1');assert.equal(movement.donationId,'r1_donor')
  await assert.rejects(execute(actor,{...screen,operationId:'32345678-1234-1234-1234-123456789012'}),{status:409})
})

test('historical confirmations cannot stock again even without a retry receipt', async () => {
  const {store,execute}=setup({'donations/r1_donor':{matchId:'r1_donor',confirmedAt:at,units:2}})
  const before=structuredClone([...store.docs])
  await assert.rejects(execute(actor,confirm),{status:409})
  assert.deepEqual([...store.docs],before)
})

test('revoked consent, stale acceptance version and invalid units cannot write progress or completion', async () => {
  for (const overrides of [
    {'donorConsents/r1_donor_data-sharing':{donorId:'donor',matchId:'r1_donor',consentType:'Data Sharing',revokedAt:at}},
    {'donorMatches/r1_donor':{donorId:'donor',requestId:'r1',responseStatus:'Accepted',screeningStatus:'Cleared',donationStage:'Processing',guidelinesAcknowledged:true,acceptanceVersion:2}},
  ]) {
    const {store,execute}=setup(overrides),before=structuredClone([...store.docs])
    await assert.rejects(execute(actor,confirm),{status:409})
    await assert.rejects(execute(actor,{action:'screenMatch',matchId:'r1_donor',screeningStatus:'Deferred',reason:'Visit deferred',operationId:issue.operationId}),{status:409})
    assert.deepEqual([...store.docs],before)
  }
  const {store,execute}=setup()
  for(const units of [0,-1,1.5,'2',Number.MAX_SAFE_INTEGER+1]) await assert.rejects(execute(actor,{...confirm,units}),{status:400})
  assert.equal(records(store,'donations').length,0)
})

test('completion releases only its own commitment and rejects a different active commitment', async () => {
  const {store,execute}=setup({'donorCommitments/donor':{matchId:'r1_donor'}})
  await execute(actor,confirm)
  assert.equal(store.docs.has('donorCommitments/donor'),false)
  const other=setup({'donorCommitments/donor':{matchId:'other'}})
  await assert.rejects(other.execute(actor,confirm),{status:409})
  assert.equal(other.store.docs.get('donorCommitments/donor').matchId,'other')
})

test('failed terminal deferral rolls back both the commitment release and the audit receipt', async () => {
  const {store,execute}=setup({'donorCommitments/donor':{matchId:'r1_donor'}})
  const before=structuredClone([...store.docs])
  const input={action:'screenMatch',matchId:'r1_donor',screeningStatus:'Deferred',reason:'Screening requires deferral',operationId:issue.operationId}
  store.failNextCommit(new Error('deferral unavailable'))
  await assert.rejects(execute(actor,input),/deferral unavailable/)
  assert.deepEqual([...store.docs],before)
  await execute(actor,input)
  assert.equal(store.docs.has('donorCommitments/donor'),false)
})

test('completion refuses malformed stock and cannot invent a replacement count', async () => {
  for(const unitsAvailable of [null,undefined,'4',-1,1.5,Number.MAX_SAFE_INTEGER]) {
    const {store,execute}=setup({'hospitals/h1/inventory/rbc_O-':{component:'rbc',bloodType:'O-',unitsAvailable}})
    const before=structuredClone([...store.docs])
    await assert.rejects(execute(actor,confirm),{status:409})
    assert.deepEqual([...store.docs],before)
  }
})
