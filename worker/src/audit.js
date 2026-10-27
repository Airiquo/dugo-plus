/**
 * Hash-chain audit trail for F10.
 *
 * Appends tamper-evident blocks to `auditBlocks` using a hash chain,
 * stores hashed references (never raw IDs), and supports verification.
 */

import {
  beginTransaction,
  commitWrites,
  documentName,
  FirestoreError,
  getDocumentInTransaction,
  runQuery,
  runQueryInTransaction,
  toFirestoreFields,
} from './firestore.js'

const GENESIS_PREV_HASH = '0'

// Reserved head document. It holds no `sequence` field, so it never appears in
// the sequence-ordered chain queries; it exists so concurrent appends read it
// and conflict instead of forking the chain.
const AUDIT_HEAD_ID = '_meta'

/**
 * Create a canonical JSON string for hashing.
 * Fields are sorted to ensure deterministic hashing.
 */
function canonicalize(obj) {
  const sorted = {}
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    if (obj[key] !== undefined) {
      sorted[key] = obj[key]
    }
  }
  return JSON.stringify(sorted)
}

/**
 * Compute SHA-256 hash and return hex string.
 */
async function sha256Hex(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compute HMAC-SHA256 and return hex string.
 */
async function hmacSha256Hex(secret, message) {
  if (!secret) {
    // Fallback if secret not configured (should not happen in production)
    return sha256Hex(message)
  }
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(message)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, msgData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash an entity/actor reference using HMAC.
 * Never store raw IDs.
 */
export async function hashRef(env, ref) {
  if (!ref) return ''
  const secret = env.AUDIT_HASH_SECRET || ''
  return hmacSha256Hex(secret, String(ref))
}

/**
 * Get the latest audit block by sequence.
 */
export async function getLatestAuditBlock(env) {
  const query = {
    from: [{ collectionId: 'auditBlocks' }],
    orderBy: [{ field: { fieldPath: 'sequence' }, direction: 'DESCENDING' }],
    limit: 1,
  }
  const results = await runQuery(env, query)
  return results[0] || null
}

/**
 * Compute the record hash for a block.
 */
export async function computeRecordHash(block) {
  const payload = {
    prevHash: block.prevHash,
    sequence: block.sequence,
    eventType: block.eventType,
    entityType: block.entityType || '',
    hashedEntityRef: block.hashedEntityRef,
    hashedActorRef: block.hashedActorRef,
    actorRole: block.actorRole || '',
    createdAt: block.createdAt instanceof Date ? block.createdAt.toISOString() : block.createdAt,
    correctsBlockId: block.correctsBlockId || null,
  }
  const canonical = canonicalize(payload)
  return sha256Hex(canonical)
}

/** Latest block read inside a transaction (its doc joins the read set). */
async function getLatestAuditBlockInTransaction(env, transaction) {
  const results = await runQueryInTransaction(
    env,
    {
      from: [{ collectionId: 'auditBlocks' }],
      orderBy: [{ field: { fieldPath: 'sequence' }, direction: 'DESCENDING' }],
      limit: 1,
    },
    transaction,
  )
  return results[0] || null
}

/**
 * Append one block, atomically.
 *
 * The read of the head document and the latest block, the sequence
 * assignment, and the write all happen inside one Firestore transaction, so two
 * concurrent appends cannot fork the chain — the loser conflicts and the caller
 * retries. The block's document id is its `recordHash`.
 */
export async function appendAuditBlockSimple(env, params) {
  const {
    eventType,
    entityType = null,
    entityId = null,
    actorId = null,
    actorRole = null,
    correctsBlockId = null,
    createdAt = new Date(),
  } = params

  if (!eventType) throw new FirestoreError(400, 'eventType is required')

  const transaction = await beginTransaction(env)

  // Reading the head (which normally does not exist) serializes appends: every
  // transaction touches it, so they cannot both commit.
  await getDocumentInTransaction(env, 'auditBlocks', AUDIT_HEAD_ID, transaction)

  const latest = await getLatestAuditBlockInTransaction(env, transaction)
  const sequence = latest ? Number(latest.data.sequence) + 1 : 1
  const prevHash = latest ? latest.data.recordHash : GENESIS_PREV_HASH

  const hashedEntityRef = await hashRef(env, entityId || '')
  const hashedActorRef = await hashRef(env, actorId || '')

  const blockData = {
    prevHash,
    sequence,
    eventType,
    entityType,
    hashedEntityRef,
    hashedActorRef,
    actorRole,
    createdAt,
    correctsBlockId,
  }
  blockData.recordHash = await computeRecordHash(blockData)

  const blockWrite = {
    update: {
      name: documentName(env, `auditBlocks/${blockData.recordHash}`),
      fields: toFirestoreFields(blockData),
    },
    currentDocument: { exists: false },
  }
  const headWrite = {
    update: {
      name: documentName(env, `auditBlocks/${AUDIT_HEAD_ID}`),
      fields: toFirestoreFields({
        headSequence: sequence,
        headHash: blockData.recordHash,
        updatedAt: new Date(),
      }),
    },
    updateMask: { fieldPaths: ['headSequence', 'headHash', 'updatedAt'] },
  }

  await commitWrites(env, transaction, [blockWrite, headWrite])
  return { created: true, block: blockData }
}

/**
 * Verify the entire audit chain.
 */
export async function verifyAuditChain(env) {
  // Get all blocks ordered by sequence
  const query = {
    from: [{ collectionId: 'auditBlocks' }],
    orderBy: [{ field: { fieldPath: 'sequence' }, direction: 'ASCENDING' }],
  }
  const blocks = await runQuery(env, query)
  
  if (blocks.length === 0) {
    return { valid: true, count: 0, message: 'Empty chain' }
  }
  
  // Check genesis
  if (blocks[0].data.sequence !== 1 || blocks[0].data.prevHash !== GENESIS_PREV_HASH) {
    return { valid: false, brokenAt: 1, reason: 'Invalid genesis block' }
  }
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].data
    
    // Recompute hash
    const computedHash = await computeRecordHash(block)
    if (computedHash !== block.recordHash) {
      return { valid: false, brokenAt: block.sequence, reason: 'Hash mismatch' }
    }
    
    // Check link to previous
    if (i > 0) {
      const prevBlock = blocks[i - 1].data
      if (block.prevHash !== prevBlock.recordHash) {
        return { valid: false, brokenAt: block.sequence, reason: 'Chain link broken' }
      }
    }
  }
  
  return { valid: true, count: blocks.length }
}

/**
 * Get all audit blocks (for admin UI).
 */
export async function getAllAuditBlocks(env) {
  const query = {
    from: [{ collectionId: 'auditBlocks' }],
    orderBy: [{ field: { fieldPath: 'sequence' }, direction: 'DESCENDING' }],
  }
  const blocks = await runQuery(env, query)
  return blocks.map(b => ({
    id: b.id,
    ...b.data,
  }))
}
