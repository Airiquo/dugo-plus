import { FieldValue } from 'firebase-admin/firestore'
import { admin } from './firebase.js'

// The same operations `functions/index.js` exposes as callables (FR-040): create
// a hospital account, delete a sign-in record, publish claims. Kept in step with
// that file by hand — the callable is the path once Blaze is enabled.

/** An error carrying the HTTP status the transport layer answers with. */
export class ServiceError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const HOSPITAL_ID = /^[a-z0-9][a-z0-9-]{2,59}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** `users.role` → the claim `firestore.rules` checks (D15/D26). */
const CLAIM_ROLE = { donor: 'donor', hospital: 'staff', admin: 'admin' }

function text(value, field, { required = true, max = 200 } = {}) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (required && !trimmed) throw new ServiceError(400, `${field} is required.`)
  if (trimmed.length > max) {
    throw new ServiceError(400, `${field} must be ${max} characters or fewer.`)
  }
  return trimmed
}

function coordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function geohash(lat, lng, precision = 7) {
  if (lat === null || lng === null) return ''
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return ''
  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let hash = ''
  let bits = 0
  let bit = 0
  let even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2
      if (lng > mid) {
        bit = (bit << 1) | 1
        lngMin = mid
      } else {
        bit <<= 1
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat > mid) {
        bit = (bit << 1) | 1
        latMin = mid
      } else {
        bit <<= 1
        latMax = mid
      }
    }
    even = !even
    if (++bits === 5) {
      hash += BASE32[bit]
      bits = 0
      bit = 0
    }
  }
  return hash
}

/**
 * Create a hospital account: Auth user, `users/{uid}`, `hospitals/{hospitalId}`
 * and the `role: 'staff'` + `hospitalId` claims.
 *
 * @param {Record<string, unknown>} input
 * @param {string} [actorUid] the admin whose call this is
 * @returns {Promise<{ uid: string, hospitalId: string }>}
 */
export async function createHospitalAccount(input, actorUid) {
  const { auth, db } = admin()
  const payload = input ?? {}

  const email = text(payload.email, 'Email', { max: 254 }).toLowerCase()
  if (!EMAIL.test(email)) throw new ServiceError(400, 'Enter a valid email address.')
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (password.length < 8 || password.length > 128) {
    throw new ServiceError(400, 'The temporary password must be 8-128 characters.')
  }

  const fullName = text(payload.fullName, 'Contact name', { max: 120 })
  const facilityName = text(payload.facilityName, 'Facility name', { max: 160 })
  const address = text(payload.address, 'Address', { max: 240 })
  const contactNumber = text(payload.contactNumber, 'Contact number', { max: 40 })
  const city = text(payload.city, 'City', { required: false, max: 120 })

  const latitude = coordinate(payload.latitude)
  const longitude = coordinate(payload.longitude)
  if ((latitude === null) !== (longitude === null)) {
    throw new ServiceError(400, 'Give both coordinates, or neither.')
  }
  if (latitude !== null && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    throw new ServiceError(400, 'Those coordinates are out of range.')
  }

  const requestedId = text(payload.hospitalId, 'Facility id', { required: false, max: 60 })
  if (requestedId && !HOSPITAL_ID.test(requestedId)) {
    throw new ServiceError(
      400,
      'Facility id must be lowercase letters, numbers and dashes (3-60 characters).',
    )
  }
  const hospitalId =
    requestedId || `${slugify(facilityName) || 'hospital'}-${Math.random().toString(36).slice(2, 6)}`

  const existing = await db.doc(`hospitals/${hospitalId}`).get()
  if (existing.exists) throw new ServiceError(409, 'A facility with that id already exists.')

  let userRecord
  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
      // The team creates the account over a verified channel, so the address is
      // treated as confirmed; the hospital can still change the password.
      emailVerified: true,
    })
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      throw new ServiceError(409, 'That email already has an account.')
    }
    if (error.code === 'auth/invalid-password') {
      throw new ServiceError(400, 'Firebase rejected that password.')
    }
    throw new ServiceError(500, 'The sign-in account could not be created.')
  }

  try {
    const batch = db.batch()
    batch.set(db.doc(`users/${userRecord.uid}`), {
      role: 'hospital',
      fullName,
      email,
      phoneNumber: contactNumber,
      hospitalId,
      city,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      geohash: geohash(latitude, longitude),
      status: 'Active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.set(db.doc(`hospitals/${hospitalId}`), {
      name: facilityName,
      address,
      contactNumber,
      city,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      geohash: geohash(latitude, longitude),
      status: 'Active',
      createdBy: actorUid || 'account-service',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    await auth.setCustomUserClaims(userRecord.uid, { role: 'staff', hospitalId })
  } catch {
    // Roll back the Auth user so a retry does not hit "email already in use".
    await auth.deleteUser(userRecord.uid).catch(() => {})
    await db.doc(`users/${userRecord.uid}`).delete().catch(() => {})
    await db.doc(`hospitals/${hospitalId}`).delete().catch(() => {})
    throw new ServiceError(500, 'The hospital record could not be created. Nothing was kept.')
  }

  return { uid: userRecord.uid, hospitalId }
}

/**
 * Delete the sign-in record for an account whose profile is already closed
 * (Suspended/Removed). Firestore history is retained on purpose.
 *
 * @param {string} uid
 * @param {string} [actorUid]
 * @returns {Promise<{ uid: string }>}
 */
export async function deleteAuthAccount(uid, actorUid) {
  const { auth, db } = admin()
  const target = text(uid, 'Account id', { max: 128 })
  if (actorUid && target === actorUid) {
    throw new ServiceError(412, 'You cannot delete your own sign-in account.')
  }

  try {
    await auth.deleteUser(target)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw new ServiceError(500, 'The sign-in account could not be deleted.')
    }
  }

  const profile = db.doc(`users/${target}`)
  const snapshot = await profile.get()
  if (snapshot.exists && snapshot.get('status') !== 'Removed') {
    await profile.update({
      status: 'Removed',
      statusReason: 'Sign-in account deleted by an administrator.',
      statusUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  return { uid: target }
}

/**
 * Publish Firebase Auth claims from `users/{uid}` (D15/D26), for one account or
 * every account. Replaces the `set:claims` script for the common case.
 *
 * @param {string} [targetUid] one account; omitted means every account
 * @returns {Promise<{ updated: number, skipped: string[] }>}
 */
export async function setClaims(targetUid) {
  const { auth, db } = admin()
  /** @type {Array<[string, Record<string, unknown>]>} */
  let entries

  if (targetUid) {
    const requested = text(targetUid, 'Account id', { max: 128 })
    const doc = await db.doc(`users/${requested}`).get()
    if (!doc.exists) throw new ServiceError(404, 'No profile exists for that account.')
    entries = [[requested, doc.data() ?? {}]]
  } else {
    const snap = await db.collection('users').get()
    entries = snap.docs.map((doc) => [doc.id, doc.data() ?? {}])
  }

  let updated = 0
  const skipped = []
  for (const [uid, data] of entries) {
    const role = CLAIM_ROLE[data.role]
    if (!role) {
      skipped.push(uid)
      continue
    }
    const claims = { role }
    if (data.hospitalId) claims.hospitalId = data.hospitalId
    await auth.setCustomUserClaims(uid, claims)
    updated += 1
  }
  return { updated, skipped }
}

/**
 * Give the first administrator its claim: set `users/{uid}.role = 'admin'` and
 * the matching custom claim. Guarded by `BOOTSTRAP_TOKEN` in the transport, and
 * meant to be used once, then the token removed.
 *
 * @param {string} email the admin's sign-in email
 * @returns {Promise<{ uid: string, email: string }>}
 */
export async function bootstrapAdmin(email) {
  const { auth, db } = admin()
  const address = text(email, 'Email', { max: 254 }).toLowerCase()
  if (!EMAIL.test(address)) throw new ServiceError(400, 'Enter a valid email address.')

  let userRecord
  try {
    userRecord = await auth.getUserByEmail(address)
  } catch {
    throw new ServiceError(
      404,
      'No sign-in account uses that email. Create it in the Firebase console first.',
    )
  }

  await db.doc(`users/${userRecord.uid}`).set(
    {
      role: 'admin',
      fullName: userRecord.displayName ?? '',
      email: address,
      status: 'Active',
    },
    { merge: true },
  )
  await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' })

  return { uid: userRecord.uid, email: address }
}
