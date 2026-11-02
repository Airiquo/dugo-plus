/**
 * Identity Toolkit Admin REST client for the account routes.
 *
 * The Worker does not run `firebase-admin`, so user administration (create a
 * sign-in record, delete one, publish custom claims) goes straight to Google's
 * Identity Toolkit Admin API with a service-account OAuth token. Firestore
 * writes reuse `firestore.js`; this module covers only the Auth side.
 */

import { HttpError } from './http.js'
import { accessToken, serviceAccountProject } from './firestore.js'

const IDENTITY_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit'

async function identityFetch(env, path, body) {
  const project = serviceAccountProject(env)
  const token = await accessToken(env, IDENTITY_SCOPE)
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(project)}${path}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  const text = await response.text().catch(() => '')
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    const detail = payload?.error?.message || text.slice(0, 200)
    throw new HttpError(
      response.status,
      detail || 'Identity Toolkit request failed',
    )
  }
  return payload ?? {}
}

/**
 * Create an email/password sign-in record.
 *
 * @returns {Promise<{ uid: string }>}
 */
export async function createUser(
  env,
  {
    uid,
    email,
    password,
    displayName,
    emailVerified = false,
    disabled = false,
  },
) {
  let result
  try {
    result = await identityFetch(env, '/accounts', {
      email,
      password,
      displayName,
      emailVerified,
      localId: uid,
      disabled,
    })
  } catch (error) {
    const message = String(error?.message ?? '')
    if (error?.status === 409 || /EMAIL_EXISTS/i.test(message)) {
      throw new HttpError(409, 'That email already has an account.')
    }
    if (/PASSWORD/i.test(message)) {
      throw new HttpError(400, 'Firebase rejected that password.')
    }
    throw error
  }
  if (!result.localId)
    throw new HttpError(500, 'Identity Toolkit returned no uid')
  return { uid: result.localId }
}

/** Read one sign-in record without exposing credentials. */
export async function getUser(env, uid) {
  const result = await identityFetch(env, '/accounts:lookup', {
    localId: [uid],
  })
  return result.users?.[0] || null
}

/** Enable a provisioned login after its claims have been published. */
export async function enableUser(env, uid) {
  await identityFetch(env, '/accounts:update', {
    localId: uid,
    disableUser: false,
  })
}

/** Publish custom claims. An empty object clears them. */
export async function setCustomUserClaims(env, uid, claims) {
  await identityFetch(env, '/accounts:update', {
    localId: uid,
    customAttributes: JSON.stringify(claims ?? {}),
  })
}

/** Delete a sign-in record. A missing uid is not an error. */
export async function deleteUser(env, uid) {
  try {
    await identityFetch(env, '/accounts:delete', { localId: uid })
  } catch (error) {
    // USER_NOT_FOUND means the record is already gone, which is the goal.
    if (
      error?.status === 404 ||
      /USER_NOT_FOUND/i.test(String(error?.message ?? ''))
    )
      return
    throw error
  }
}
