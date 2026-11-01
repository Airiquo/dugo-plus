import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRecordHash, hashRef } from './audit.js'

// F10a hash-chain primitives. The append/verify paths need Firestore, but the
// hashing is pure and is what tamper-evidence rests on, so it is pinned here.

const base = {
  prevHash: '0',
  sequence: 1,
  eventType: 'DonationConfirmed',
  entityType: 'donation',
  hashedEntityRef: 'e'.repeat(64),
  hashedActorRef: 'a'.repeat(64),
  actorRole: 'staff',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  correctsBlockId: null,
}

test('computeRecordHash is deterministic and a 64-char hex digest', async () => {
  const a = await computeRecordHash(base)
  const b = await computeRecordHash({ ...base })
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{64}$/)
})

test('computeRecordHash changes when any hashed field changes', async () => {
  const a = await computeRecordHash(base)
  const b = await computeRecordHash({ ...base, sequence: 2 })
  const c = await computeRecordHash({ ...base, prevHash: 'f'.repeat(64) })
  assert.notEqual(a, b)
  assert.notEqual(a, c)
})

test('computeRecordHash is stable across an equivalent Date instance', async () => {
  const a = await computeRecordHash(base)
  const b = await computeRecordHash({ ...base, createdAt: new Date('2026-01-01T00:00:00.000Z') })
  assert.equal(a, b)
})

test('computeRecordHash treats missing optional fields the same as empty', async () => {
  const empty = { ...base, entityType: '', actorRole: '', correctsBlockId: null }
  const missing = { ...base, entityType: undefined, actorRole: undefined, correctsBlockId: undefined }
  assert.equal(await computeRecordHash(empty), await computeRecordHash(missing))
})

test('hashRef is deterministic per secret and differs by secret and input', async () => {
  const a = await hashRef({ AUDIT_HASH_SECRET: 'secret-1' }, 'donor-1')
  const b = await hashRef({ AUDIT_HASH_SECRET: 'secret-1' }, 'donor-1')
  const c = await hashRef({ AUDIT_HASH_SECRET: 'secret-1' }, 'donor-2')
  const d = await hashRef({ AUDIT_HASH_SECRET: 'secret-2' }, 'donor-1')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.notEqual(a, d)
  assert.match(a, /^[0-9a-f]{64}$/)
})

test('hashRef never returns the raw reference', async () => {
  const hashed = await hashRef({ AUDIT_HASH_SECRET: 'secret' }, 'user-123')
  assert.ok(!hashed.includes('user-123'))
})
