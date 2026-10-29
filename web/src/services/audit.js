/**
 * Client service for F10 audit trail.
 */

import { auth } from '../lib/firebase.js'

const ENDPOINT = (import.meta.env.VITE_MATCHING_ENDPOINT ?? '').trim().replace(/\/$/, '')

/**
 * Fetch audit blocks via Worker (admin only).
 */
export async function getAuditBlocks() {
  if (!ENDPOINT) throw new Error('Matching endpoint not configured')
  if (!auth?.currentUser) throw new Error('Not signed in')

  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${ENDPOINT}/audit/blocks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = payload?.error || `Failed to fetch audit blocks (${response.status})`
    throw new Error(message)
  }
  return payload?.blocks || []
}

/**
 * Verify the audit chain via Worker.
 */
export async function verifyAuditChain() {
  if (!ENDPOINT) throw new Error('Matching endpoint not configured')
  if (!auth?.currentUser) throw new Error('Not signed in')

  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${ENDPOINT}/audit/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = payload?.error || `Verification failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

/**
 * Best-effort audit append for a feature event (F10b).
 *
 * The data action has already happened, so a failed append must not fail the
 * caller: this catches and reports, and returns whether a block was written.
 * The Worker fills the actor from the caller's token and hashes the refs, so
 * only `eventType` and an entity reference cross the wire.
 *
 * @param {{ eventType: string, entityType?: string|null, entityId?: string|null,
 *   correctsBlockId?: string|null }} event
 * @returns {Promise<boolean>} true when the block was appended
 */
export async function recordAuditEvent({
  eventType,
  entityType = null,
  entityId = null,
  correctsBlockId = null,
}) {
  if (!eventType) return false
  try {
    await appendAuditBlock({ eventType, entityType, entityId, correctsBlockId })
    return true
  } catch (error) {
    // Not configured, signed out, or the Worker is down: the action stands, the
    // event is simply not recorded (PHASES §10). Never throw.
    console.info('[audit] append skipped', eventType, error?.message || error)
    return false
  }
}

/**
 * Append an audit block via Worker (admin only).
 */
export async function appendAuditBlock(data) {
  if (!ENDPOINT) throw new Error('Matching endpoint not configured')
  if (!auth?.currentUser) throw new Error('Not signed in')

  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${ENDPOINT}/audit/append`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = payload?.error || `Append failed (${response.status})`
    throw new Error(message)
  }
  return payload
}
