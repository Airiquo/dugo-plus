import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Admin SDK handles for the account service.
 *
 * Credentials come from `FIREBASE_SERVICE_ACCOUNT`, the service-account JSON as
 * a string, set in the host's environment. The key never reaches the browser.
 *
 * @returns {{ auth: import('firebase-admin/auth').Auth, db: import('firebase-admin/firestore').Firestore }}
 */
export function admin() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.')
    let credentials
    try {
      credentials = JSON.parse(raw)
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.')
    }
    initializeApp({ credential: cert(credentials) })
  }
  return { auth: getAuth(), db: getFirestore() }
}
