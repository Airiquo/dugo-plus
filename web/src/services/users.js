import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { geohash, isCoordinate } from '../utils/geohash'

/**
 * `users/{uid}` profiles — the account type the guards read back.
 *
 * The data model is `docs/firestore_schema.md` §2.1, and the stored shape now
 * matches it: `fullName`, `phoneNumber`, flat `latitude`/`longitude`, and the
 * lowercase role set. `address` is not collected, and `isVerified` is not
 * stored — Firebase Auth owns email verification (D5). `status` and `hospitalId`
 * are written but not yet read (D22). `firestore.rules` freezes `role` and
 * `lastDonationAt`.
 */

/** Every account type that exists. */
export const ROLES = ['donor', 'hospital', 'admin']

/** Every account status. Written by an admin screen; nothing reads it yet (D22). */
export const STATUSES = ['Active', 'Suspended', 'Removed']

/** The eight blood types, in the order a picker should read them. */
export const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

/** geohash precision stored with a location. ~150 m, enough for a donor radius. */
export const GEOHASH_PRECISION = 7

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

/**
 * Where a signed-in account of this type lands. Admins get the built admin
 * area; donors get their profile screen; hospital accounts have no screens yet
 * and get the "you're in" notice (`pages/shared/Welcome.jsx`, which also
 * forwards any account that ends up there wrongly). An account with no role yet
 * goes to the landing page — self-registration is donor-only (D20), so a
 * missing role means the auto-provision write failed, not a choice to make.
 *
 * @param {string|null} role
 * @returns {string} a route path
 */
export function homeFor(role) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'donor') return '/donor/profile'
  if (ROLES.includes(role)) return '/welcome'
  return '/'
}

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Firestore's local copy of `request.auth.uid`; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Normalise a location into the stored shape, or `null` when there is nothing
 * usable. `coordinates` is optional: a donor may give a city and decline the
 * browser location prompt (or the browser may refuse it), and that is a valid
 * profile rather than an error.
 *
 * @param {{ coordinates?: { lat: number, lng: number }|null, city?: string }} [location]
 * @returns {{ latitude: number, longitude: number, geohash: string,
 *             city: string } | null}
 */
function normaliseLocation(location) {
  if (!location) return null
  const city = text(location.city)
  const lat = Number(location.coordinates?.lat)
  const lng = Number(location.coordinates?.lng)
  const hasPoint = isCoordinate(lat, lng)
  if (!hasPoint && !city) return null
  return {
    latitude: hasPoint ? lat : 0,
    longitude: hasPoint ? lng : 0,
    geohash: hasPoint ? geohash(lat, lng, GEOHASH_PRECISION) : '',
    city,
  }
}

/**
 * The identity fields of a profile, as the SDK's document type. Used for reads
 * so a caller never touches a raw document.
 *
 * @typedef {{
 *   role: string, fullName: string, email: string, phoneNumber: string,
 *   bloodType: string, dateOfBirth: Date|null,
 *   latitude: number, longitude: number, geohash: string, city: string,
 *   hospitalId: string, status: string,
 *   lastDonationAt: Date|null, updatedAt: Date|null,
 * }} Profile
 */

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
 * @param {{ role: string, fullName?: string, email?: string }} profile
 */
export async function writeProfile(uid, profile) {
  requireDb()
  await setDoc(doc(db, 'users', uid), {
    role: profile.role,
    fullName: profile.fullName ?? '',
    email: profile.email ?? '',
    phoneNumber: '',
    status: 'Active',
    createdAt: serverTimestamp(),
  })
}

/**
 * Save the editable part of a donor profile (FR-04). `merge: true` so this never
 * has to know about `createdAt`, and so a field left out of `changes` is not
 * wiped. `role` is deliberately not writable here: the rules freeze it, because
 * letting a profile edit change the account type is the escalation path.
 *
 * Eligibility is not written. It is derived on read from `dateOfBirth` and
 * `lastDonationAt` (`utils/eligibility.js`), so a donor cannot declare it, and
 * the facility decides at the donation itself (FR-031).
 *
 * @param {string} uid
 * @param {{
 *   fullName?: string, bloodType?: string, dateOfBirth?: Date|null,
 *   lastDonationAt?: Date|null, phoneNumber?: string,
 *   location?: { coordinates?: { lat: number, lng: number }|null,
 *                city?: string }|null,
 * }} changes
 */
export async function saveProfile(uid, changes) {
  requireDb()
  const data = { updatedAt: serverTimestamp() }

  if ('fullName' in changes) data.fullName = text(changes.fullName)

  if ('bloodType' in changes) {
    const type = text(changes.bloodType)
    if (type && !BLOOD_TYPES.includes(type)) {
      throw new Error(`Unknown blood type: ${type}`)
    }
    data.bloodType = type
  }

  if ('dateOfBirth' in changes) data.dateOfBirth = changes.dateOfBirth || null
  if ('lastDonationAt' in changes) data.lastDonationAt = changes.lastDonationAt || null
  if ('phoneNumber' in changes) data.phoneNumber = text(changes.phoneNumber)

  if ('location' in changes) {
    // Stored flat, or cleared to the empty strings when the donor cleared it.
    const next = normaliseLocation(changes.location)
    data.latitude = next?.latitude ?? 0
    data.longitude = next?.longitude ?? 0
    data.geohash = next?.geohash ?? ''
    data.city = next?.city ?? ''
  }

  await setDoc(doc(db, 'users', uid), data, { merge: true })
}

/** A Firestore value that may be a Timestamp, Date, or absent, as a Date. */
function asDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return null
}

/**
 * Read a profile for an account, or `null` when the account has none (created
 * before roles existed, or a Google sign-in that has not picked a role yet).
 *
 * Every field is narrowed to the expected type, so a hand-edited document
 * cannot put a non-string where the UI expects one.
 *
 * @param {string} uid
 * @returns {Promise<Profile | null>}
 */
export async function readProfile(uid) {
  requireDb()
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data() ?? {}

  const latitude = Number(data.latitude)
  const longitude = Number(data.longitude)

  return {
    // Only trusted values survive: an unknown or absent role reads as absent,
    // so the guards do not open a route for it.
    role: ROLES.includes(data.role) ? data.role : null,
    fullName: text(data.fullName),
    email: text(data.email),
    phoneNumber: text(data.phoneNumber),
    bloodType: BLOOD_TYPES.includes(data.bloodType) ? data.bloodType : '',
    dateOfBirth: asDate(data.dateOfBirth),
    lastDonationAt: asDate(data.lastDonationAt),
    latitude: isCoordinate(latitude, longitude) ? latitude : 0,
    longitude: isCoordinate(latitude, longitude) ? longitude : 0,
    geohash: text(data.geohash),
    city: text(data.city),
    hospitalId: text(data.hospitalId),
    status: STATUSES.includes(data.status) ? data.status : 'Active',
    updatedAt: asDate(data.updatedAt),
  }
}

