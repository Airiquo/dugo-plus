/**
 * Privileged account operations (FR-040) on the matching Worker.
 *
 * Mirrors `workers/account-service/lib/actions.js` and `functions/index.js`
 * against Google REST APIs, because the Worker cannot run `firebase-admin`.
 * The `POST /accounts` route calls these after gating on the caller's
 * `role: 'admin'` custom claim.
 */

import { HttpError } from './http.js'
import {
  deleteDocument,
  getDocument,
  runQuery,
  updateDocumentIfUnchanged,
  writeNewDocuments,
} from './firestore.js'
import { createUser, deleteUser, setCustomUserClaims } from './identitytoolkit.js'
import { geohash, isCoordinate } from '../../web/src/utils/geohash.js'

const HOSPITAL_ID = /^[a-z0-9][a-z0-9-]{2,59}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** `users.role` -> the claim `firestore.rules` checks (D15/D26). */
const CLAIM_ROLE = { donor: 'donor', hospital: 'staff', admin: 'admin' }

function text(value, field, { required = true, max = 200 } = {}) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (required && !trimmed) throw new HttpError(400, `${field} is required.`)
  if (trimmed.length > max) {
    throw new HttpError(400, `${field} must be ${max} characters or fewer.`)
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

/**
 * The claims to publish for a `users/{uid}` profile, or null when the role is
 * not one the rules know.
 *
 * @param {Record<string, unknown>} data
 * @returns {Record<string, string> | null}
 */
export function claimsForUser(data) {
  const role = CLAIM_ROLE[data?.role]
  if (!role) return null
  const claims = { role }
  if (data.hospitalId) claims.hospitalId = data.hospitalId
  return claims
}

/**
 * Create a hospital account: sign-in record, `users/{uid}`,
 * `hospitals/{hospitalId}` and the `role: 'staff'` + `hospitalId` claims.
 *
 * @param {Record<string, unknown>} input
 * @param {string} [actorUid] the admin whose call this is
 * @returns {Promise<{ uid: string, hospitalId: string }>}
 */
export async function createHospitalAccount(env, input, actorUid) {
  const payload = input ?? {}

  const email = text(payload.email, 'Email', { max: 254 }).toLowerCase()
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'The temporary password must be 8-128 characters.')
  }

  const fullName = text(payload.fullName, 'Contact name', { max: 120 })
  const facilityName = text(payload.facilityName, 'Facility name', { max: 160 })
  const address = text(payload.address, 'Address', { max: 240 })
  const contactNumber = text(payload.contactNumber, 'Contact number', { max: 40 })
  const city = text(payload.city, 'City', { required: false, max: 120 })

  const latitude = coordinate(payload.latitude)
  const longitude = coordinate(payload.longitude)
  if ((latitude === null) !== (longitude === null)) {
    throw new HttpError(400, 'Give both coordinates, or neither.')
  }
  if (latitude !== null && !isCoordinate(latitude, longitude)) {
    throw new HttpError(400, 'Those coordinates are out of range.')
  }
  const hasPoint = latitude !== null && longitude !== null

  const requestedId = text(payload.hospitalId, 'Facility id', { required: false, max: 60 })
  if (requestedId && !HOSPITAL_ID.test(requestedId)) {
    throw new HttpError(
      400,
      'Facility id must be lowercase letters, numbers and dashes (3-60 characters).',
    )
  }
  const hospitalId =
    requestedId || `${slugify(facilityName) || 'hospital'}-${Math.random().toString(36).slice(2, 6)}`

  const existing = await getDocument(env, 'hospitals', hospitalId)
  if (existing) throw new HttpError(409, 'A facility with that id already exists.')

  const { uid } = await createUser(env, {
    email,
    password,
    displayName: fullName,
    // The team creates the account over a verified channel, so the address is
    // treated as confirmed; the hospital can still change the password.
    emailVerified: true,
  })

  const now = new Date()
  const hash = hasPoint ? geohash(latitude, longitude) : ''
  try {
    const { existing: conflicts } = await writeNewDocuments(env, [
      {
        path: `users/${uid}`,
        data: {
          role: 'hospital',
          fullName,
          email,
          phoneNumber: contactNumber,
          hospitalId,
          city,
          latitude: latitude ?? 0,
          longitude: longitude ?? 0,
          geohash: hash,
          status: 'Active',
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        path: `hospitals/${hospitalId}`,
        data: {
          name: facilityName,
          address,
          contactNumber,
          city,
          latitude: latitude ?? 0,
          longitude: longitude ?? 0,
          geohash: hash,
          status: 'Active',
          createdBy: actorUid || 'account-service',
          createdAt: now,
          updatedAt: now,
        },
      },
    ])
    if (conflicts > 0) {
      throw new HttpError(409, 'A facility or profile with those details already exists.')
    }
    await setCustomUserClaims(env, uid, { role: 'staff', hospitalId })
  } catch (error) {
    // Roll back the sign-in record so a retry does not hit "email already in use".
    await deleteUser(env, uid).catch(() => {})
    await deleteDocument(env, `users/${uid}`).catch(() => {})
    await deleteDocument(env, `hospitals/${hospitalId}`).catch(() => {})
    if (error instanceof HttpError) throw error
    throw new HttpError(500, 'The hospital record could not be created. Nothing was kept.')
  }

  return { uid, hospitalId }
}

/**
 * Delete the sign-in record for an account whose profile is already closed
 * (Suspended/Removed). Firestore history is retained on purpose.
 *
 * @returns {Promise<{ uid: string }>}
 */
export async function deleteAuthAccount(env, uid, actorUid) {
  const target = text(uid, 'Account id', { max: 128 })
  if (actorUid && target === actorUid) {
    throw new HttpError(412, 'You cannot delete your own sign-in account.')
  }

  await deleteUser(env, target)

  const profile = await getDocument(env, 'users', target)
  if (profile && profile.data?.status !== 'Removed') {
    await updateDocumentIfUnchanged(
      env,
      `users/${target}`,
      {
        status: 'Removed',
        statusReason: 'Sign-in account deleted by an administrator.',
        statusUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
      profile.updateTime,
    )
  }

  return { uid: target }
}

/**
 * Publish Firebase Auth claims from `users/{uid}` (D15/D26), for one account or
 * every account.
 *
 * @param {string} [targetUid] one account; omitted means every account
 * @returns {Promise<{ updated: number, skipped: string[] }>}
 */
export async function setClaims(env, targetUid) {
  /** @type {Array<[string, Record<string, unknown>]>} */
  let entries

  if (targetUid) {
    const requested = text(targetUid, 'Account id', { max: 128 })
    const doc = await getDocument(env, 'users', requested)
    if (!doc) throw new HttpError(404, 'No profile exists for that account.')
    entries = [[requested, doc.data ?? {}]]
  } else {
    const docs = await runQuery(env, { from: [{ collectionId: 'users' }] })
    entries = docs.map((doc) => [doc.id, doc.data ?? {}])
  }

  let updated = 0
  const skipped = []
  for (const [uid, data] of entries) {
    const claims = claimsForUser(data)
    if (!claims) {
      skipped.push(uid)
      continue
    }
    await setCustomUserClaims(env, uid, claims)
    updated += 1
  }
  return { updated, skipped }
}
