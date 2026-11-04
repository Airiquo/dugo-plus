import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks, createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run using an isolated Firestore emulator.')
const rootRequire = createRequire(new URL('../../../package.json', import.meta.url))
const modules = Object.fromEntries(['firebase/firestore'].map(name => [name, rootRequire.resolve(name).replace(/index\.cjs\.js$/, 'index.mjs')]))
const { doc, writeBatch, Timestamp, getDoc } = await import(modules['firebase/firestore'])
globalThis.__completionReads = []
registerHooks({
  resolve(specifier, context, next) {
    if (modules[specifier]) return next(modules[specifier], context)
    if (specifier.startsWith('.') && context.parentURL?.includes('/web/src/')) {
      const candidate = new URL(specifier + '.js', context.parentURL)
      if (existsSync(candidate)) return next(candidate.href, context)
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('/web/src/lib/firebase.js')) return { format: 'module', shortCircuit: true,
      source: 'export let db; export const auth=null; export function setFixtureDb(value){db=value}' }
    const loaded = next(url, context)
    if (url.endsWith('/web/src/services/donations.js')) {
      loaded.source = loaded.source.toString().replace('getDocs,', 'getDocs as actualGetDocs,')
        + '\nconst getDocs = async query => { const result = await actualGetDocs(query); globalThis.__completionReads.push(result.size); return result; };'
    }
    return loaded
  },
})
const fixture = await import('../lib/firebase.js')
const service = await import('./donations.js')
let environment, donor
before(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  environment = await initializeTestEnvironment({ projectId: 'demo-dugo-completion-donor', firestore: {
    host, port: Number(port), rules: readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8'),
  } })
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore(), batch = writeBatch(db), date = Timestamp.fromDate(new Date('2026-11-04T01:00:00Z'))
    batch.set(doc(db, 'users/alice'), { role: 'donor', status: 'Active' })
    batch.set(doc(db, 'donationTypes/whole-blood'), { name: 'Whole Blood', intervalDays: 56 })
    for (let index = 0; index < 31; index++) {
      const id = 'legacy-' + String(index).padStart(3, '0')
      batch.set(doc(db, 'donations/' + id), { donorId: 'alice', hospitalId: 'h', donationDate: date, confirmedAt: date, units: 1, bloodType: 'O+' })
      batch.set(doc(db, 'donorMatches/' + id), { donorId: 'alice', requestId: 'request', donationTypeId: 'whole-blood' })
    }
    batch.set(doc(db, 'donations/newest'), { donorId: 'alice', hospitalId: 'h', donationDate: Timestamp.fromDate(new Date('2026-11-04T02:00:00Z')),
      status: 'Completed', completedAt: date, confirmedAt: date, component: 'rbc', donationType: 'whole-blood', units: 2, bloodType: 'O-' })
    batch.set(doc(db, 'donations/foreign'), { donorId: 'bob', hospitalId: 'h', donationDate: date, confirmedAt: date, units: 99 })
    batch.set(doc(db, 'donorMatches/foreign'), { donorId: 'bob', requestId: 'request', donationTypeId: 'whole-blood' })
    batch.set(doc(db, 'users/bob'), { role: 'donor', fullName: 'Private donor' })
    await batch.commit()
  })
  donor = environment.authenticatedContext('alice', { email_verified: true }).firestore()
  fixture.setFixtureDb(donor)
})
after(async () => { await environment?.cleanup() })

test('donor completion history retains legacy rows and batches legacy type lookups in 10-record groups with owner predicates', async () => {
  globalThis.__completionReads.length = 0
  const rows = await service.listDonorDonations('alice')
  assert.equal(rows.length, 32)
  assert.equal(rows.reduce((total, row) => total + row.units, 0), 33)
  assert.ok(rows.every(row => row.donationTypeId === 'whole-blood' && row.intervalDays === 56))
  assert.ok(rows.every(row => row.completedAt instanceof Date))
  assert.deepEqual(globalThis.__completionReads, [32, 10, 10, 10, 1])
  assert.equal(rows.some(row => row.id === 'foreign'), false)
  await assertFails(service.listDonorDonations('bob'))
  await assertFails(getDoc(doc(donor, 'users/bob')))
})

test('latest completed donation needs no match read and retains compatibility timestamps', async () => {
  globalThis.__completionReads.length = 0
  const row = await service.latestDonorDonation('alice')
  assert.equal(row.id, 'newest'); assert.equal(row.units, 2); assert.equal(row.bloodType, 'O-')
  assert.deepEqual(row.completedAt, row.confirmedAt)
  assert.deepEqual(globalThis.__completionReads, [1])
})
