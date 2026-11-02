/**
 * Client service for F10 audit trail.
 */

import { auth } from '../lib/firebase.js'

const ENDPOINT = (import.meta.env.VITE_MATCHING_ENDPOINT ?? '').trim().replace(/\/$/, '')
const ACCOUNT_ENDPOINT = (import.meta.env.VITE_ACCOUNT_SERVICE_URL ?? '').trim().replace(/\/$/, '')

/** Read one page of account activity; an old Worker never falls back to unfiltered blocks. */
export async function getAccountHistory(accountId, before = null) {
  if (!ACCOUNT_ENDPOINT) throw new Error('The account history service is not configured.')
  if (!auth?.currentUser) throw new Error('Sign in again to view account history.')
  const url = new URL(`${ACCOUNT_ENDPOINT}/history`)
  url.searchParams.set('accountId', accountId)
  if (before !== null) url.searchParams.set('before', before)
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.historyVersion !== 1 || !Array.isArray(payload.events)) {
    throw new Error(response.status === 404 || (response.ok && payload?.historyVersion !== 1)
      ? 'Account history is unavailable. The updated Worker must be deployed before this view can load.'
      : payload?.error || 'Account history could not be loaded. Please try again.')
  }
  return payload
}

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
