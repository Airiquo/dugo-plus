// Privileged account operations (FR-040). The browser cannot create or delete a
// Firebase Auth account, so these two callables do it with the Admin SDK. Every
// call is checked against the `role == 'admin'` custom claim the rules use.
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

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const HOSPITAL_ID = /^[a-z0-9][a-z0-9-]{2,59}$/

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
 * and the `role: 'staff'` + `hospitalId` claims in one call.
 *
 * Input: email, password, fullName, facilityName, address, contactNumber,
 *        city?, latitude?, longitude?, hospitalId?
 */
export const createHospitalAccount = onCall({ region: 'us-central1' }, async (request) => {
  requireAdmin(request)
  const input = request.data ?? {}

  const email = text(input.email, 'Email', { max: 254 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.')
  }
  const password = typeof input.password === 'string' ? input.password : ''
  if (password.length < 8 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'The temporary password must be 8–128 characters.')
  }

  const fullName = text(input.fullName, 'Contact name', { max: 120 })
  const facilityName = text(input.facilityName, 'Facility name', { max: 160 })
  const address = text(input.address, 'Address', { max: 240 })
  const contactNumber = text(input.contactNumber, 'Contact number', { max: 40 })
  const city = text(input.city, 'City', { required: false, max: 120 })

  const latitude = coordinate(input.latitude)
  const longitude = coordinate(input.longitude)
  if ((latitude === null) !== (longitude === null)) {
    throw new HttpsError('invalid-argument', 'Give both coordinates, or neither.')
  }
  if (latitude !== null && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    throw new HttpsError('invalid-argument', 'Those coordinates are out of range.')
  }

  const requestedId = text(input.hospitalId, 'Facility id', { required: false, max: 60 })
  if (requestedId && !HOSPITAL_ID.test(requestedId)) {
    throw new HttpsError(
      'invalid-argument',
      'Facility id must be lowercase letters, numbers and dashes (3–60 characters).',
    )
  }
  const hospitalId =
    requestedId || `${slugify(facilityName) || 'hospital'}-${Math.random().toString(36).slice(2, 6)}`

  const existing = await db.doc(`hospitals/${hospitalId}`).get()
  if (existing.exists) {
    throw new HttpsError('already-exists', 'A facility with that id already exists.')
  }

  let userRecord
  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
      // The team creates the account over a verified channel, so the address is
      // treated as confirmed; the user can still change the password.
      emailVerified: true,
    })
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'That email already has an account.')
    }
    if (error.code === 'auth/invalid-password') {
      throw new HttpsError('invalid-argument', 'Firebase rejected that password.')
    }
    throw new HttpsError('internal', 'The sign-in account could not be created.')
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
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    await auth.setCustomUserClaims(userRecord.uid, { role: 'staff', hospitalId })
  } catch (error) {
    // Roll back the Auth user so a retry does not hit "email already in use".
    await auth.deleteUser(userRecord.uid).catch(() => {})
    await db.doc(`users/${userRecord.uid}`).delete().catch(() => {})
    await db.doc(`hospitals/${hospitalId}`).delete().catch(() => {})
    throw new HttpsError('internal', 'The hospital record could not be created. Nothing was kept.')
  }

  return { uid: userRecord.uid, hospitalId }
})

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
