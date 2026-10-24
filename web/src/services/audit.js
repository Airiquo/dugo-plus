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
