import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionRead, invalidateSessionReads, clearSessionCache, sessionWatch } from './sessionCache.js'

test('shares reads, invalidates writes, and prevents a prior session refilling the cache', async () => {
  clearSessionCache()
  let resolve, calls = 0
  const loader = () => { calls++; return new Promise(done => { resolve = done }) }
  const first = sessionRead('profile:a', loader), second = sessionRead('profile:a', loader)
  await Promise.resolve(); assert.equal(calls, 1)
  clearSessionCache(); resolve('old'); assert.equal(await first, 'old'); assert.equal(await second, 'old')
  assert.equal(await sessionRead('profile:a', async () => 'new'), 'new')
  invalidateSessionReads('profile:a')
  assert.equal(await sessionRead('profile:a', async () => 'saved'), 'saved')
})
test('aborting one consumer leaves a shared read usable and failures can retry', async () => {
  clearSessionCache()
  const abort = new AbortController()
  let resolve
  const loader = () => new Promise(done => { resolve = done })
  const cancelled = sessionRead('facility:a', loader, { signal: abort.signal })
  const other = sessionRead('facility:a', loader)
  await Promise.resolve(); abort.abort(); resolve('ok')
  await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(await other, 'ok')
  await assert.rejects(sessionRead('failed', async () => { throw Error('offline') }))
  assert.equal(await sessionRead('failed', async () => 'retry'), 'retry')
})
test('inventory subscriptions share live updates and release at last consumer/sign-out', () => {
  clearSessionCache(); let starts=0, stops=0, publish
  const start = next => { starts++; publish=next; return () => stops++ }
  const a=[], b=[]
  const stopA=sessionWatch('inventory:a',start,v=>a.push(v))
  publish(1)
  const stopB=sessionWatch('inventory:a',start,v=>b.push(v))
  publish(2); assert.equal(starts,1); assert.deepEqual(a,[1,2]); assert.deepEqual(b,[1,2])
  stopA(); assert.equal(stops,0); stopB(); assert.equal(stops,1)
  sessionWatch('inventory:a',start,()=>{}); clearSessionCache(); assert.equal(stops,2)
})
