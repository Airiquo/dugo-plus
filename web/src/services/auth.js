import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as signOutOfFirebase,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

const NOT_CONFIGURED =
  'Firebase is not configured. Copy web/.env.example to web/.env.local and add your project values.'

/** Friendly text for the Firebase error codes these screens can produce. */
const ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'That email already has an account — sign in instead.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/popup-blocked': 'Your browser blocked the Google pop-up. Allow pop-ups and try again.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled in the Firebase console.',
  'auth/unauthorized-domain': 'This domain is not authorised in the Firebase console.',
  'auth/network-request-failed': 'Network unreachable — check your connection.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/invalid-api-key': 'Firebase rejected the API key in web/.env.local.',
  // The code the SDK returns verbatim when the key is wrong (dots and all).
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    'Firebase rejected the API key in web/.env.local.',
  'auth/app-not-authorized': 'This domain is not authorised in the Firebase console.',
  'auth/invalid-app-id': 'Firebase rejected the app ID in web/.env.local.',
}

/** Turns a Firebase error into a sentence worth showing a visitor. */
export function authErrorMessage(error) {
  if (!error) return ''
  const mapped = ERROR_MESSAGES[error.code]
  if (mapped) return mapped
  // Unmapped codes would otherwise keep the SDK's "Firebase: Error (auth/…)"
  // wrapper; keep the code (it is the only clue for a misconfiguration) but drop
  // the noise.
  const cleaned = error.message?.replace(/^Firebase:\s*Error\s*\((.+?)\)\.?$/, 'Firebase error: $1')
  return cleaned || 'Something went wrong. Try again.'
}

/**
 * Firebase Auth access layer — the only module that talks to the SDK.
 *
 * `hooks/useAuth.jsx` (the context) and the pages above it never import
 * `firebase/auth` directly; they call these functions. When no project is
 * configured `auth` is null and every action rejects with a readable message;
 * in practice the shell renders `pages/shared/NotConfigured` first, so this is
 * a safety net rather than a supported mode.
 */
function requireAuth() {
  if (!auth) throw new Error(NOT_CONFIGURED)
}

/**
 * Subscribe to session changes (sign-in, sign-out, page load). Returns the
 * unsubscribe function, or `undefined` when Firebase is not configured.
 */
export function observeAuth(callback) {
  if (!auth) return undefined
  return onAuthStateChanged(auth, callback)
}

export async function signIn(email, password) {
  requireAuth()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

/**
 * `onUser` is called with the fresh user after the profile write, because
 * `updateProfile()` does not notify `onAuthStateChanged`.
 *
 * Deliberately writes no Firestore document: account creation notifies
 * `onAuthStateChanged` before this returns, so the hook that writes the profile
 * has to be the same one that invalidates the in-flight read (see
 * `hooks/useAuth.jsx`).
 */
export async function signUp(name, email, password, onUser) {
  requireAuth()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (name) {
    try {
      await updateProfile(credential.user, { displayName: name })
    } catch {
      // The account exists and the session is live, so a profile write that
      // fails (a flaky network) must not fail the whole sign-up. The shell
      // falls back to the email local part.
    }
  }
  onUser?.(credential.user)
  return credential.user
}

export async function signInWithGoogle() {
  requireAuth()
  const credential = await signInWithPopup(auth, googleProvider)
  return credential.user
}

export async function signOut() {
  if (!auth) return
  await signOutOfFirebase(auth)
}
