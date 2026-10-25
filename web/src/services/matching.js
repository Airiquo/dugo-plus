/**
 * Client trigger for the F7 matching Worker.
 *
 * Request creation calls this after the `bloodRequests` document exists. The
 * Worker writes matches asynchronously; this call is not on the critical path.
 * When the endpoint is unset the app keeps working and the Worker cron fallback
 * picks the request up later.
 */

import { auth } from '../lib/firebase.js'

const ENDPOINT = (import.meta.env.VITE_MATCHING_ENDPOINT ?? '').trim().replace(/\/$/, '')

/** True when the matching Worker endpoint is configured. */
export function isMatchingConfigured() {
  return ENDPOINT !== ''
}

/**
 * Ask the Worker to match one request immediately.
 *
 * @param {string} requestId
 * @returns {Promise<{ok: boolean, skipped?: string, [key: string]: unknown}>}
 */
export async function triggerMatch(requestId) {
  if (!ENDPOINT) return { ok: false, skipped: 'not-configured' }
  if (!auth?.currentUser) return { ok: false, skipped: 'signed-out' }

  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${ENDPOINT}/match`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = payload?.error || `Matching request failed (${response.status})`
    throw new Error(message)
  }
  return payload
}
