// Privileged account operations (FR-040). Creating a hospital account moved to
// the browser (D30) and the free account service (D29); this callable is the
// Blaze fallback for deleting a Firebase Auth account. Every call is checked
// against the `role == 'admin'` custom claim the rules use.
//
// Deploying needs the Blaze plan (PHASES §7); the client reports a missing
// deployment as a clear sentence instead of failing silently.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

initializeApp()
const auth = getAuth()
const db = getFirestore()

function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  if (request.auth.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only an administrator can manage accounts.')
  }
}

function text(value, field, { required = true, max = 200, min = 0 } = {}) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (required && !trimmed) throw new HttpsError('invalid-argument', `${field} is required.`)
  if (trimmed.length < min) throw new HttpsError('invalid-argument', `${field} is too short.`)
  if (trimmed.length > max) {
    throw new HttpsError('invalid-argument', `${field} must be ${max} characters or fewer.`)
  }
  return trimmed
}

/**
 * Delete the sign-in record for an account. Used after the profile has been
 * closed (Suspended/Removed); Firestore history is retained on purpose.
 *
 * Input: uid
 */
export const deleteAuthAccount = onCall({ region: 'us-central1' }, async (request) => {
  requireAdmin(request)
  const uid = text(request.data?.uid, 'Account id', { max: 128 })
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot delete your own sign-in account.')
  }

  try {
    await auth.deleteUser(uid)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'The sign-in account could not be deleted.')
    }
  }

  const profile = db.doc(`users/${uid}`)
  const snapshot = await profile.get()
  if (snapshot.exists && snapshot.get('status') !== 'Removed') {
    await profile.update({
      status: 'Removed',
      statusReason: 'Sign-in account deleted by an administrator.',
      statusUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  return { uid }
})
