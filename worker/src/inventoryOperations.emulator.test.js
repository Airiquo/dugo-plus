import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { transactionStore } from './firestore.js'
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
    tx.create('users/'+donorId,{role:'donor',status:'Active',bloodType:'O-',dateOfBirth:new Date('1990-01-01')})
    tx.create('hospitals/'+hospitalId,{status:'Active'})
    tx.create('bloodRequests/'+requestId,{hospitalId,status:'collecting',component:'rbc',bloodType:'A+',quantity:3})
    tx.create('donorMatches/'+matchId,{requestId,donorId,responseStatus:'Accepted',guidelinesAcknowledged:true,screeningStatus:'Cleared',donationTypeId:'whole-blood'})
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
  const input={action:'screenMatch',matchId:f.matchId,screeningStatus:'Deferred',operationId:'12345678-1234-1234-1234-123456789012'}
  await assert.rejects(execute({...f.actor,claims:{role:'staff',hospitalId:'wrong'}},input),{status:403})
  await execute(f.actor,input);await execute(f.actor,input)
  assert.equal((await read('donorMatches',f.matchId)).data.screeningStatus,'Deferred')
  await assert.rejects(execute(f.actor,f.input),{status:409})
  await execute(f.actor,{...input,screeningStatus:'Cleared',operationId:'22345678-1234-1234-1234-123456789012'})
  await execute(f.actor,f.input)
  await assert.rejects(execute(f.actor,{...input,operationId:'32345678-1234-1234-1234-123456789012'}),{status:409})
})
