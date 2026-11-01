/**
 * Hash-chain audit trail for F10.
 *
 * Appends tamper-evident blocks to `auditBlocks` using a hash chain,
 * stores hashed references (never raw IDs), and supports verification.
 */

import {
  getDocument,
  transactionStore,
  documentName,
  FirestoreError,
  runQuery,
  toFirestoreFields,
} from './firestore.js'
import { dueQuery } from './accountOperations.js'

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
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, msgData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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
    createdAt:
      block.createdAt instanceof Date
        ? block.createdAt.toISOString()
        : block.createdAt,
    correctsBlockId: block.correctsBlockId || null,
  }
  if (block.contextHash) payload.contextHash = block.contextHash
  const canonical = canonicalize(payload)
  return sha256Hex(canonical)
}

/**
 * Append one block, atomically.
 *
 * The read of the head document and the latest block, the sequence
 * assignment, and the write all happen inside one Firestore transaction, so two
 * concurrent appends cannot fork the chain — the loser conflicts and the caller
 * retries. The block's document id is its `recordHash`.
 */
export async function appendAuditBlockSimple(
  env,
  params,
  store = transactionStore(env),
) {
  const {
    eventType,
    entityType = null,
    entityId = null,
    actorId = null,
    actorRole = null,
    correctsBlockId = null,
    createdAt = new Date(),
    context = null,
    outboxId = null,
  } = params

  if (!eventType) throw new FirestoreError(400, 'eventType is required')
  if (!env.AUDIT_HASH_SECRET)
    throw new FirestoreError(503, 'Audit HMAC secret is required')

  return store.transact(async (tx) => {
    const outbox = outboxId ? await tx.get('auditOutbox', outboxId) : null
    if (outboxId && (!outbox || outbox.data.state !== 'Pending'))
      return { created: false }

    // Reading the head (which normally does not exist) serializes appends: every
    // transaction touches it, so they cannot both commit.
    await tx.get('auditBlocks', AUDIT_HEAD_ID)

    const latest =
      (
        await tx.query({
          from: [{ collectionId: 'auditBlocks' }],
          orderBy: [
            { field: { fieldPath: 'sequence' }, direction: 'DESCENDING' },
          ],
          limit: 1,
        })
      )[0] || null
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
    const redactedEntity = await tx.get(
      'auditRedactions',
      hashedEntityRef || '_none',
    )
    const redactedActor = await tx.get(
      'auditRedactions',
      hashedActorRef || '_none',
    )
    const detail =
      context && !redactedEntity && !redactedActor
        ? {
            reason: String(context.reason || '').slice(0, 2000),
            beforeStatus: String(context.beforeStatus || '').slice(0, 32),
            afterStatus: String(context.afterStatus || '').slice(0, 32),
          }
        : null
    if (detail) blockData.contextHash = await hashRef(env, canonicalize(detail))
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

    const extraWrites = []
    if (detail)
      extraWrites.push({
        update: {
          name: documentName(env, `auditContexts/${blockData.recordHash}`),
          fields: toFirestoreFields({
            ...detail,
            hashedEntityRef,
            hashedActorRef,
          }),
        },
        currentDocument: { exists: false },
      })
    if (outboxId)
      extraWrites.push({
        update: {
          name: documentName(env, `auditOutbox/${outboxId}`),
          fields: toFirestoreFields({
            state: 'Delivered',
            recordHash: blockData.recordHash,
            deliveredAt: new Date(),
          }),
        },
      })
    for (const write of [blockWrite, headWrite, ...extraWrites]) tx.write(write)
    return { created: true, block: blockData }
  })
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
  if (
    blocks[0].data.sequence !== 1 ||
    blocks[0].data.prevHash !== GENESIS_PREV_HASH
  ) {
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
        return {
          valid: false,
          brokenAt: block.sequence,
          reason: 'Chain link broken',
        }
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
  return blocks.map((b) => ({
    id: b.id,
    ...b.data,
  }))
}

/** Deliver one pending event; the chain append and outbox acknowledgement are atomic. */
export async function deliverAuditOutbox(env, id) {
  const outbox = await getDocument(env, 'auditOutbox', id)
  if (!outbox || outbox.data.state === 'Delivered') return
  if (!env.AUDIT_HASH_SECRET)
    throw new FirestoreError(503, 'Audit HMAC secret is required')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await appendAuditBlockSimple(env, { ...outbox.data, outboxId: id })
    } catch (error) {
      if (![409, 10].includes(Number(error?.status)) || attempt === 4)
        throw error
    }
  }
}

/** Retry a bounded page independently of matching and notification processing. */
export async function retryAuditOutbox(env, now = new Date()) {
  const pending = await runQuery(env, dueQuery('auditOutbox', now))
  let delivered = 0
  for (const event of pending) {
    try {
      await deliverAuditOutbox(env, event.id)
      delivered += 1
    } catch {
      await transactionStore(env)
        .transact(async (tx) => {
          const current = await tx.get('auditOutbox', event.id)
          if (current?.data.state === 'Pending')
            tx.update(`auditOutbox/${event.id}`, {
              nextAttemptAt: new Date(now.getTime() + 60000),
            })
        })
        .catch(() => {})
    }
  }
  return { considered: pending.length, delivered }
}

/** Remove erasable event detail in bounded pages while retaining the immutable chain. */
export async function redactAuditContexts(
  env,
  now = new Date(),
  store = transactionStore(env),
) {
  const jobs = await store.query(dueQuery('auditRedactions', now, 5))
  for (const job of jobs) {
    const pages = await Promise.all(
      ['hashedEntityRef', 'hashedActorRef'].map((field) =>
        store.query({
          from: [{ collectionId: 'auditContexts' }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'EQUAL',
              value: { stringValue: job.id },
            },
          },
          limit: 100,
        }),
      ),
    )
    const ids = [...new Set(pages.flat().map((doc) => doc.id))]
    await store.transact(async (tx) => {
      await tx.get('auditRedactions', job.id)
      for (const id of ids) tx.delete(`auditContexts/${id}`)
      tx.update(`auditRedactions/${job.id}`, {
        state: pages.every((page) => page.length < 100)
          ? 'Completed'
          : 'Pending',
        nextAttemptAt: now,
      })
    })
  }
  return { considered: jobs.length }
}
