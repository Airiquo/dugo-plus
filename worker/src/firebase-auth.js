/**
 * Verify a Firebase ID token with Identity Toolkit.
 *
 * The Worker runs outside Firebase, so it uses the public Web API key to look
 * up the token. The returned uid is the only identity the matcher trusts.
 */

import { HttpError } from './http.js'

const LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup'

/** Parse the `customAttributes` JSON string the lookup returns, or {}. */
function parseClaims(raw) {
  if (!raw || typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function verifyIdToken(env, idToken) {
  if (!idToken) throw new HttpError(401, 'Missing bearer token')
  if (!env.FIREBASE_API_KEY) throw new HttpError(500, 'FIREBASE_API_KEY is not configured')

  const response = await fetch(`${LOOKUP_URL}?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) throw new HttpError(401, 'Invalid or expired token')

  const user = payload?.users?.[0]
  if (!user?.localId) throw new HttpError(401, 'Invalid or expired token')
  if (user.disabled) throw new HttpError(403, 'Account is disabled')
  if (user.emailVerified !== true) throw new HttpError(403, 'Verify your email before matching')

  return {
    uid: user.localId,
    email: user.email ?? null,
    emailVerified: true,
    // Custom claims (`role`, `hospitalId`) published by scripts/set-claims.mjs
    // (D26). Admin/staff authority on the Worker reads these, not `users.role`.
    claims: parseClaims(user.customAttributes),
  }
}
