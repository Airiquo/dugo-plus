import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

/** Every account type that exists. */
export const ROLES = ['donor', 'hospital', 'admin']

/** Display name for an account type, as the shell labels the signed-in user. */
const ROLE_LABELS = {
  donor: 'Donor',
  hospital: 'Hospital / Blood Bank',
  admin: 'System admin',
}

/**
 * @param {string|null} role
 * @returns {string} the label for that account type, or '' when unknown.
 */
export function roleLabel(role) {
  return ROLE_LABELS[role] ?? ''
}

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Firestore's local copy of `request.auth.uid`; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/**
 * Account profiles — `users/{uid}`.
 *
 * Firebase Auth knows nothing about roles, so the account type chosen at sign-up
 * lives in Firestore beside the user. Read and write only through this module:
 * `hooks/useAuth.jsx` exposes the result as `role`, and the security rules in
 * `firestore.rules` allow the document to be touched only by its own owner.
 *
 * This is a client-only design: the role is written from the browser, so it is
 * not authoritative against a determined user. In production you would set it as
 * a custom claim from a Cloud Function instead (see README, "Known limitation").
 */

/**
 * Create the profile for a new account. Written after `createUserWithEmailAndPassword`
 * so `request.auth.uid` already matches, which is what the rules check.
 *
 * @param {string} uid - the freshly created account's uid
 * @param {{ role: string, name?: string, email?: string }} profile
 */
export async function writeProfile(uid, profile) {
  requireDb()
  await setDoc(doc(db, 'users', uid), {
    role: profile.role,
    name: profile.name ?? '',
    email: profile.email ?? '',
    createdAt: serverTimestamp(),
  })
}

/**
 * Read a profile for an account, or `null` when the account has none (created
 * before roles existed, or a Google sign-in that has not picked a role yet).
 *
 * @param {string} uid
 * @returns {Promise<{ role: string|null, name: string, email: string } | null>}
 */
export async function readProfile(uid) {
  requireDb()
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data() ?? {}
  return {
    // Only trusted values survive: an unknown or absent role reads as absent,
    // so the picker runs again rather than the app guessing.
    role: ROLES.includes(data.role) ? data.role : null,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
  }
}
