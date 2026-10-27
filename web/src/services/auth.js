import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload as reloadUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as signOutOfFirebase,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

const NOT_CONFIGURED =
  'Firebase is not configured. Copy web/.env.example to web/.env.local and add your project values.'

/**
 * Friendly text for the Firebase error codes these screens can produce, and the
 * field each one belongs to. `field` is the input the message is rendered under;
 * no field means the error belongs to the card as a whole (a provider or
 * configuration failure that no single input caused).
 *
 * Sign-in credential failures all arrive as `auth/invalid-credential`: this
 * project has email-enumeration protection on (it is the default for projects
 * created after September 2023), so the backend answers an unknown email and a
 * wrong password with the same error rather than revealing which was wrong.
 * Verified against the live project — it returns INVALID_LOGIN_CREDENTIALS for
 * an address with no account. `user-not-found` and `wrong-password` are kept
 * mapped in case enumeration protection is ever turned off, but they do not fire
 * while it is on. Because neither field can be identified, that one message is
 * shown against the form rather than blamed on the password input.
 */
const ERROR_INFO = {
  'auth/invalid-email': {
    field: 'email',
    message: 'That does not look like an email address. Check for a missing @ or a typo.',
  },
  'auth/missing-email': {
    field: 'email',
    message: 'Enter your email address to continue.',
  },
  'auth/user-not-found': {
    field: 'email',
    message: 'No account is registered with that email. Check the address, or create an account.',
  },
  'auth/missing-password': {
    field: 'password',
    message: 'Enter your password.',
  },
  'auth/wrong-password': {
    field: 'password',
    message: 'That password is incorrect. Try again, or reset it if you have forgotten it.',
  },
  'auth/invalid-credential': {
    field: null,
    message:
      'That email and password do not match an account. Check both, or reset your password if you have forgotten it.',
  },
  'auth/email-already-in-use': {
    field: 'email',
    message: 'That email already has an account. Sign in instead, or reset its password.',
  },
  'auth/weak-password': {
    field: 'password',
    message:
      'That password is too weak. Use at least 8 characters, including a letter and a number.',
  },
  'auth/popup-closed-by-user': {
    field: null,
    message: 'Google sign-in was closed before it finished. Nothing was changed.',
  },
  'auth/cancelled-popup-request': {
    field: null,
    message: 'Google sign-in was closed before it finished. Nothing was changed.',
  },
  'auth/popup-blocked': {
    field: null,
    message:
      'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
  },
  'auth/account-exists-with-different-credential': {
    field: 'email',
    message:
      'An account already uses that email with a different sign-in method. Sign in the way you first registered.',
  },
  'auth/operation-not-allowed': {
    field: null,
    message: 'That sign-in method is not enabled for this project. Ask the Dugo+ team to enable it.',
  },
  'auth/unauthorized-domain': {
    field: null,
    message: 'This domain is not authorised for sign-in. Ask the Dugo+ team to add it.',
  },
  'auth/app-not-authorized': {
    field: null,
    message: 'This domain is not authorised for sign-in. Ask the Dugo+ team to add it.',
  },
  'auth/network-request-failed': {
    field: null,
    message: 'Could not reach the network. Check your connection and try again.',
  },
  'auth/too-many-requests': {
    field: null,
    message: 'Too many attempts. Wait a minute, then try again.',
  },
  'auth/invalid-api-key': {
    field: null,
    message: 'Firebase rejected the API key in web/.env.local.',
  },
  // The code the SDK returns verbatim when the key is wrong (dots and all).
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': {
    field: null,
    message: 'Firebase rejected the API key in web/.env.local.',
  },
  'auth/invalid-app-id': {
    field: null,
    message: 'Firebase rejected the app ID in web/.env.local.',
  },
}

/** Turns a Firebase error into a sentence worth showing a visitor. */
export function authErrorMessage(error) {
  if (!error) return ''
  const mapped = ERROR_INFO[error.code]
  if (mapped) return mapped.message
  // Unmapped codes would otherwise keep the SDK's "Firebase: Error (auth/…)"
  // wrapper; keep the code (it is the only clue for a misconfiguration) but drop
  // the noise.
  const cleaned = error.message?.replace(/^Firebase:\s*Error\s*\((.+?)\)\.?$/, 'Firebase error: $1')
  return cleaned || 'Something went wrong. Try again.'
}

/**
 * The same mapping, shaped for the form screens: `{ field, message }` where
 * `field` may be null (a card-level problem). Messages raised by this module
 * itself rather than Firebase — the not-configured guard and the "no signed-in
 * account" guards — carry no code, so they always land on the card.
 */
export function authErrorDetail(error) {
  if (!error) return null
  const mapped = ERROR_INFO[error.code]
  if (mapped) return { field: mapped.field, message: mapped.message }
  return { field: null, message: authErrorMessage(error) }
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

/** Send Firebase's password-reset email (FR-48). */
export async function sendPasswordReset(email) {
  requireAuth()
  if (!email) throw new Error('Enter your email address.')
  await sendPasswordResetEmail(auth, email)
}

export async function signIn(email, password) {  requireAuth()
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
  try {
    await sendEmailVerification(credential.user)
  } catch {
    // The account and session are already live, so a verification email that
    // does not go out must not fail the sign-up. `/verify-email` offers a resend.
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

/** Send the account-verification email (FR-01, NFR-12). */
export async function sendVerificationEmail(target = auth?.currentUser) {
  requireAuth()
  if (!target) throw new Error('No account is signed in.')
  await sendEmailVerification(target)
}

/**
 * Ask Firebase for the latest user record and return the fresh object.
 * `emailVerified` only changes when the SDK re-reads it, so the verify screen
 * calls this before believing the link was clicked.
 */
export async function reloadCurrentUser() {
  requireAuth()
  const target = auth?.currentUser
  if (!target) throw new Error('No account is signed in.')
  await reloadUser(target)
  return target
}

/**
 * Force-refresh the ID token so freshly published custom claims apply without a
 * sign-out (D26). Claims are set server-side (`scripts/set-claims.mjs`).
 */
export async function refreshClaims() {
  const target = auth?.currentUser
  if (!target) return null
  return target.getIdToken(true)
}

/** Update the Firebase Auth display name (the shell's greeting, FR-047). */
export async function updateDisplayName(displayName) {
  const target = auth?.currentUser
  if (!target) throw new Error('No account is signed in.')
  await updateProfile(target, { displayName })
  return target
}
