import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { transactionStore } from './firestore.js'
import { createDonorResponder } from './donorResponses.js'
import { createHospitalDonationReader, createHospitalDonationDetails } from './hospitalDonations.js'
import { documentName } from './firestore.js'
import { createInventoryManager } from './inventoryOperations.js'
import { deliverAuditOutbox, hashRef, verifyAuditChain } from './audit.js'
import worker from './index.js'
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through the Firestore emulator.')
const {privateKey} = generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{format:'pem',type:'pkcs8'},publicKeyEncoding:{format:'pem',type:'spki'}})
const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'demo-dugo-inventory',client_email:'emulator@example.test',private_key:privateKey}),FIREBASE_API_KEY:'emulator-key',AUDIT_HASH_SECRET:'isolated-inventory-test-only'}
const original=globalThis.fetch
let failCommit=false, routeActor
// Only demo Firestore traffic is forwarded. Identity and OAuth stay isolated.
globalThis.fetch=async(url,init={})=>{
  const target=new URL(url)
  if(target.hostname==='oauth2.googleapis.com') return Response.json({access_token:'emulator-owner',expires_in:3600})
  if(target.hostname==='identitytoolkit.googleapis.com') {
    if(JSON.parse(init.body).idToken!=='staff-token') return Response.json({error:{message:'INVALID_ID_TOKEN'}},{status:400})
    return Response.json({users:[{localId:routeActor.uid,emailVerified:true,customAttributes:JSON.stringify(routeActor.claims)}]})
  }
  if(target.hostname==='firestore.googleapis.com') {
    assert.match(target.pathname,/^\/v1\/projects\/demo-dugo-inventory\//)
    if(failCommit && target.pathname.endsWith(':commit') && JSON.parse(init.body).writes.some(write=>write.update?.name.includes('/auditOutbox/'))) {
      failCommit=false
      throw new Error('Injected atomic commit failure')
    }
    return original(`http://${process.env.FIRESTORE_EMULATOR_HOST}${target.pathname}${target.search}`,{...init,headers:{...init.headers,Authorization:'Bearer owner'}})
  }
  throw new Error('Unexpected external request: '+target.hostname)
}
const store=transactionStore(env)
const execute=createInventoryManager({store,hash:value=>hashRef(env,value),now:()=>new Date('2026-11-03T06:00:00Z')})
let sequence=0
async function setup(){
  const n=++sequence,hospitalId=`facility-${n}`,uid=`staff-${n}`,donorId=`donor-${n}`,requestId=`request-${n}`,matchId=`${requestId}_${donorId}`
  const actor={uid,claims:{role:'staff',hospitalId}}
  await store.transact(async tx=>{
    tx.create('users/'+uid,{role:'hospital',hospitalId,status:'Active'})
    tx.create('users/'+donorId,{role:'donor',status:'Active',fullName:'Fictional Donor',city:'Fixture City',bloodType:'O-',dateOfBirth:new Date('1990-01-01')})
    tx.create('hospitals/'+hospitalId,{status:'Active'})
    tx.create('bloodRequests/'+requestId,{hospitalId,status:'collecting',component:'rbc',bloodType:'A+',quantity:3})
    tx.create('donorMatches/'+matchId,{requestId,donorId,responseStatus:'Accepted',guidelinesAcknowledged:true,screeningStatus:'Cleared',donationStage:'Processing',donationTypeId:'whole-blood'})
    for(const [suffix,consentType] of [['data-sharing','Data Sharing'],['screening','Screening']])
      tx.create(`donorConsents/${matchId}_${suffix}`,{donorId,matchId,consentType,grantedAt:new Date(),revokedAt:null})
    if(n===1)tx.create('donationTypes/whole-blood',{intervalDays:56})
    tx.create(`hospitals/${hospitalId}/inventory/O-`,{bloodType:'O-',unitsAvailable:9})
    tx.create(`hospitals/${hospitalId}/inventory/plasma_O-`,{bloodType:'O-',component:'plasma',unitsAvailable:8})
  })
  return {actor,hospitalId,uid,donorId,requestId,matchId,input:{action:'confirmDonation',matchId,units:2}}
}
const read=(collection,id)=>store.get(collection,id)

test('REST confirmation retries concurrently without duplicating actual donor/component stock, and audit events deliver once',async()=>{
  const f=await setup()
  const results=await Promise.all([execute(f.actor,f.input),execute(f.actor,f.input)])
  assert.equal(results.filter(r=>r.replayed).length,1)
  assert.equal((await read(`hospitals/${f.hospitalId}/inventory`,'rbc_O-')).data.unitsAvailable,2)
  assert.equal((await read(`hospitals/${f.hospitalId}/inventory`,'O-')).data.unitsAvailable,9)
  assert.equal((await read(`hospitals/${f.hospitalId}/inventory`,'plasma_O-')).data.unitsAvailable,8)
  const donation=(await read('donations',f.matchId)).data
  assert.equal(donation.bloodType,'O-');assert.equal(donation.component,'rbc')
  assert.equal(donation.status,'Completed');assert.deepEqual(donation.completedAt,donation.confirmedAt)
  const movement=await read(`hospitals/${f.hospitalId}/inventory/rbc_O-/logs`,results[0].operationId)
  assert.equal(movement.data.donationId,f.matchId);assert.equal(movement.data.requestId,f.requestId)
  assert.deepEqual((await read('users',f.donorId)).data.lastDonationAt,new Date('2026-11-03T06:00:00Z'))
  for(const id of [results[0].operationId,results[0].operationId+'-stock']) {
    await deliverAuditOutbox(env,id);await deliverAuditOutbox(env,id)
    assert.equal((await read('auditOutbox',id)).data.state,'Delivered')
  }
  assert.equal((await verifyAuditChain(env)).valid,true)
})

test('REST failed commit leaves no donation/stock/clock and can recover with the same confirmation',async()=>{
  const f=await setup();failCommit=true
  await assert.rejects(execute(f.actor,f.input),/Injected atomic commit failure/)
  assert.equal(await read('donations',f.matchId),null)
  assert.equal(await read(`hospitals/${f.hospitalId}/inventory`,'rbc_O-'),null)
  assert.equal((await read('users',f.donorId)).data.lastDonationAt,undefined)
  await execute(f.actor,f.input)
  assert.equal((await read('donations',f.matchId)).data.units,2)
})

test('HTTP inventory validates bearer claims, profile/facility authority and missing audit configuration',async()=>{
  const f=await setup();routeActor=f.actor
  const request=(token='staff-token')=>new Request('https://local.example/inventory',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(f.input)})
  assert.equal((await worker.fetch(request('invalid'),env)).status,401)
  routeActor={...f.actor,claims:{role:'donor'}}
  assert.equal((await worker.fetch(request(),env)).status,403)
  routeActor={...f.actor,claims:{role:'staff',hospitalId:'another-facility'}}
  assert.equal((await worker.fetch(request(),env)).status,403)
  routeActor=f.actor
  assert.equal((await worker.fetch(request(),{...env,AUDIT_HASH_SECRET:''})).status,503)
  const response=await worker.fetch(request(),env)
  assert.equal(response.status,200)
  assert.equal((await response.json()).component,'rbc')
})

test('REST transfusion cannot overdraw or cross components; partial issuance leaves the request open and replay is safe',async()=>{
  const f=await setup();await execute(f.actor,f.input)
  const input={action:'recordTransfusion',hospitalId:f.hospitalId,bloodType:'O-',component:'rbc',units:1,requestId:f.requestId,operationId:'12345678-1234-1234-1234-123456789012'}
  await execute(f.actor,input);await execute(f.actor,input)
  assert.equal((await read(`hospitals/${f.hospitalId}/inventory`,'rbc_O-')).data.unitsAvailable,1)
  assert.equal((await read('bloodRequests',f.requestId)).data.transfusedUnits,1)
  assert.equal((await read('bloodRequests',f.requestId)).data.status,'collecting')
  await assert.rejects(execute(f.actor,{...input,units:2,operationId:'22345678-1234-1234-1234-123456789012'}),{status:409})
  await assert.rejects(execute(f.actor,{...input,component:'plasma',operationId:'32345678-1234-1234-1234-123456789012'}),{status:409})
})

test('REST screening writes are authorized, consent-bound, durable and cannot reopen a confirmed donation',async()=>{
  const f=await setup()
  const input={action:'screenMatch',matchId:f.matchId,screeningStatus:'Deferred',reason:'Screening requires a later donation attempt',operationId:'12345678-1234-1234-1234-123456789012'}
  await assert.rejects(execute({...f.actor,claims:{role:'staff',hospitalId:'wrong'}},input),{status:403})
  await execute(f.actor,input);await execute(f.actor,input)
  assert.equal((await read('donorMatches',f.matchId)).data.screeningStatus,'Deferred')
  await assert.rejects(execute(f.actor,f.input),{status:409})
  await assert.rejects(execute(f.actor,{...input,screeningStatus:'Screened',operationId:'22345678-1234-1234-1234-123456789012'}),{status:409})
  await assert.rejects(execute(f.actor,{...input,operationId:'32345678-1234-1234-1234-123456789012'}),{status:409})
})


test('REST completion serializes against accepting a second request and preserves one donation',async()=>{
  const f=await setup(),next=f.requestId+'-next',match=f.matchId+'-next'
  await store.transact(tx=>{
    tx.create('bloodRequests/'+next,{hospitalId:f.hospitalId,status:'collecting',component:'rbc',bloodType:'A+'})
    tx.create('donorMatches/'+match,{donorId:f.donorId,requestId:next,responseStatus:'Pending'})
    tx.create('donorCommitments/'+f.donorId,{matchId:f.matchId,requestId:f.requestId,donorId:f.donorId})
  })
  const accept=createDonorResponder(store,()=>new Date('2026-11-03T06:00:00Z'))
  const results=await Promise.allSettled([execute(f.actor,f.input),accept(f.donorId,{matchId:match,responseStatus:'Accepted',acknowledged:true,dataSharingConsent:true,screeningConsent:true})])
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected')
  assert.equal((await read('donorMatches',match)).data.responseStatus,'Pending')
  assert.equal(await read('donorCommitments',f.donorId),null)
  assert.equal((await read(`hospitals/${f.hospitalId}/inventory`,'rbc_O-')).data.unitsAvailable,2)
})

test('REST withdrawal vs completion has one terminal winner and never writes stock for a withdrawn donor',async()=>{
  const f=await setup(),respond=createDonorResponder(store)
  const results=await Promise.allSettled([execute(f.actor,f.input),respond(f.donorId,{matchId:f.matchId,responseStatus:'Declined'})])
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
  const donation=await read('donations',f.matchId),match=await read('donorMatches',f.matchId)
  if(donation) { assert.equal(match.data.donationStage,'Completed');assert.equal(match.data.responseStatus,'Accepted') }
  else { assert.equal(match.data.responseStatus,'Declined');assert.equal(await read(`hospitals/${f.hospitalId}/inventory`,'rbc_O-'),null) }
})

test('REST withdraw/reaccept archives prior consent, resets stage and rejects stale staff operations',async()=>{
  const f=await setup(),respond=createDonorResponder(store)
  await respond(f.donorId,{matchId:f.matchId,responseStatus:'Declined'})
  await respond(f.donorId,{matchId:f.matchId,responseStatus:'Accepted',acknowledged:true,dataSharingConsent:true,screeningConsent:true})
  const match=(await read('donorMatches',f.matchId)).data
  assert.equal(match.donationStage,'Responded');assert.equal(match.screeningStatus,null);assert.equal(match.acceptanceVersion,1)
  assert.ok((await read('donorConsents',f.matchId+'_data-sharing_v0')).data.revokedAt)
  assert.equal((await read('donorConsents',f.matchId+'_data-sharing')).data.revokedAt,null)
  const screen={action:'screenMatch',matchId:f.matchId,screeningStatus:'Screened',operationId:'12345678-1234-1234-1234-123456789012'}
  await assert.rejects(execute(f.actor,screen),{status:409})
  await execute(f.actor,{...screen,acceptanceVersion:1})
  await execute(f.actor,{...screen,acceptanceVersion:1,screeningStatus:'Processing',operationId:'22345678-1234-1234-1234-123456789012'})
  await assert.rejects(execute(f.actor,f.input),{status:409})
  await execute(f.actor,{...f.input,acceptanceVersion:1})
  await assert.rejects(respond(f.donorId,{matchId:f.matchId,responseStatus:'Declined'}),{status:409})
})

test('REST history is bounded without per-donor reads; cursors preserve 32 records and filters stay facility scoped',async()=>{
  const f=await setup()
  await store.transact(tx=>{
    for(let i=0;i<32;i++) tx.create('donations/'+f.requestId+'-'+String(i).padStart(3,'0'),{
      hospitalId:f.hospitalId,requestId:f.requestId,donorId:f.donorId,component:'rbc',bloodType:'O-',units:1,
      donationDate:new Date('2026-11-03'),confirmedAt:new Date('2026-11-03'),confirmedBy:f.uid,
    })
  })
  const calls=[]
  const bounded={transact:work=>store.transact(tx=>work({...tx,get:(...args)=>{calls.push(['get',...args]);return tx.get(...args)},query:q=>{calls.push(['query',q.limit]);return tx.query(q)}}))}
  const list=createHospitalDonationReader(bounded,path=>documentName(env,path))
  const first=await list(f.actor,{hospitalId:f.hospitalId,requestId:f.requestId})
  assert.equal(first.rows.length,25);assert.ok(first.nextCursor)
  assert.equal(calls.filter(call=>call[0]==='get').length,2)
  assert.deepEqual(calls.find(call=>call[0]==='query'),['query',26])
  assert.ok(first.rows.every(row=>row.status==='Completed'&&row.legacy))
  assert.equal(JSON.stringify(first).includes('Fictional Donor'),false)
  const last=await list(f.actor,{hospitalId:f.hospitalId,requestId:f.requestId,after:first.nextCursor})
  assert.equal(last.rows.length,7);assert.equal(last.nextCursor,null)
  assert.equal(new Set([...first.rows,...last.rows].map(row=>row.id)).size,32)
  assert.equal((await list(f.actor,{hospitalId:f.hospitalId,donorId:'another'})).rows.length,0)
  await assert.rejects(list(f.actor,{hospitalId:'another'}),{status:403})
})

test('REST donation details authorize current scope and reveal only consented allowlisted donor context',async()=>{
  const f=await setup();await execute(f.actor,f.input)
  const details=createHospitalDonationDetails(store)
  const result=await details(f.actor,{donationId:f.matchId})
  assert.equal(result.request.id,f.requestId);assert.equal(result.donation.requestId,f.requestId)
  assert.deepEqual(Object.keys(result.donor).sort(),['bloodType','city','email','fullName','phoneNumber'])
  await assert.rejects(details({...f.actor,claims:{role:'staff',hospitalId:'another'}},{donationId:f.matchId}),{status:403})
  await store.transact(tx=>tx.update('donorConsents/'+f.matchId+'_data-sharing',{revokedAt:new Date()}))
  const privateResult=await details(f.actor,{donationId:f.matchId})
  assert.equal(privateResult.donor,null);assert.equal(privateResult.privacy,'consent-required')
  assert.equal(privateResult.donation.status,'Completed')
  await store.transact(tx=>tx.update('users/'+f.uid,{status:'Suspended'}))
  await assert.rejects(details(f.actor,{donationId:f.matchId}),{status:403})
})

test('HTTP donation read routes require authentication, enforce scope and return no-store responses',async()=>{
  const f=await setup();await execute(f.actor,f.input);routeActor=f.actor
  const request=(path,input,token='staff-token')=>new Request('https://local.example'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input)})
  const listed=await worker.fetch(request('/hospital/donations',{hospitalId:f.hospitalId,requestId:f.requestId}),env)
  assert.equal(listed.status,200);assert.equal(listed.headers.get('Cache-Control'),'no-store')
  assert.equal((await listed.json()).rows[0].id,f.matchId)
  assert.equal((await worker.fetch(request('/hospital/donation-details',{donationId:f.matchId},'invalid'),env)).status,401)
  assert.equal((await worker.fetch(request('/hospital/donations',{hospitalId:'another'}),env)).status,403)
  assert.equal((await worker.fetch(request('/hospital/donation-details',{donationId:f.matchId}),env)).status,200)
})

test('REST revoked screening consent prevents completion and further progress without partial writes',async()=>{
  const f=await setup()
  await store.transact(tx=>tx.update('donorConsents/'+f.matchId+'_screening',{revokedAt:new Date()}))
  await assert.rejects(execute(f.actor,f.input),{status:409})
  await assert.rejects(execute(f.actor,{action:'screenMatch',matchId:f.matchId,screeningStatus:'Deferred',reason:'Screening outcome',operationId:'12345678-1234-1234-1234-123456789012'}),{status:409})
  assert.equal(await read('donations',f.matchId),null)
  assert.equal(await read(`hospitals/${f.hospitalId}/inventory`,'rbc_O-'),null)
  assert.equal((await read('users',f.donorId)).data.lastDonationAt,undefined)
  assert.equal((await read('donorMatches',f.matchId)).data.donationStage,'Processing')
})
