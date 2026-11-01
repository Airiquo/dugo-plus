import { deleteApp, getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, deleteUser, getAuth, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, firebaseConfig, functions } from '../lib/firebase'
import { geohash } from '../utils/geohash'

/**
 * Privileged account operations (FR-040).
 *
 * Creating a hospital account has two halves: the Firebase Auth sign-in record,
 * and the `users/{uid}` + `hospitals/{hospitalId}` documents. The documents can
 * be written straight from the console session; the sign-in record is created
 * with the client SDK on a second app instance so the admin stays signed in.
 * A `staff` custom claim cannot be set from the browser — that needs the Admin
 * SDK (`functions/` callables, or `workers/account-service/`), which is why the
 * `VITE_ACCOUNT_SERVICE_URL` path exists.
 *
 * `deleteAuthAccount` always needs the Admin SDK: one session can only delete
 * itself, never another account.
 */

/** The free account service, when one is configured (D33). */
const SERVICE_URL = (import.meta.env.VITE_ACCOUNT_SERVICE_URL || '').trim()

/** The name of the throwaway app instance the sign-up runs on. */
const SECONDARY_APP = 'dugo-account-create'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HOSPITAL_ID = /^[a-z0-9][a-z0-9-]{2,59}$/
const GEOHASH_PRECISION = 7

/**
 * What the page says when no account service answers. The Functions SDK reports
 * a missing deployment as `internal [0]` (see `accountServiceError`), so both
 * codes share one sentence and one fallback.
 */
const NOT_DEPLOYED =
  'The account service is not reachable for this project. Set VITE_ACCOUNT_SERVICE_URL ' +
  'to the free account worker (workers/account-service), or deploy the callable on Blaze.'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** An Error whose `code` reads like a Functions code, so one mapping covers both. */
function serviceError(code, message) {
  const error = new Error(message || '')
  error.code = code
  return error
}

/** HTTP status from the account service, as the Functions code the page knows. */
function codeForStatus(status) {
  switch (status) {
    case 400:
      return 'functions/invalid-argument'
    case 401:
      return 'functions/unauthenticated'
    case 403:
      return 'functions/permission-denied'
    case 404:
      return 'functions/not-found'
    case 409:
      return 'functions/already-exists'
    case 412:
      return 'functions/failed-precondition'
    default:
      return 'functions/internal'
  }
}

/**
 * Call the free account service with the signed-in admin's ID token.
 *
 * @param {string} action
 * @param {Record<string, unknown>} payload
 * @returns {Promise<Record<string, unknown>>}
 */
async function callService(action, payload) {
  const user = auth?.currentUser
  if (!user) throw serviceError('functions/unauthenticated', 'Your session has expired. Sign in again.')

  let idToken
  try {
    idToken = await user.getIdToken()
  } catch {
    throw serviceError('functions/unauthenticated', 'Your session has expired. Sign in again.')
  }

  let response
  try {
    response = await fetch(SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw serviceError('functions/unavailable', '')
  }

  let data = {}
  try {
    data = await response.json()
  } catch {
    // An empty or non-JSON body: the status below still carries the meaning.
  }

  if (!response.ok) throw serviceError(codeForStatus(response.status), data.error || '')

  const { ok: _ok, ...rest } = data
  return rest
}

/**
 * Create the sign-in record and both documents from the browser.
 *
 * The sign-in is created on a second Firebase app instance, so the admin's own
 * session is untouched. The documents are written as the admin, which the rules
 * allow through the `admin` claim. The sign-in is deleted again if the document
 * write is refused, so a retry does not hit "email already in use".
 *
 * @param {Record<string, unknown>} input
 * @returns {Promise<{ uid: string, hospitalId: string }>}
 */
async function createHospitalAccountInBrowser(input) {
  if (!db) throw new Error('Firestore is not available.')

  const payload = input ?? {}
  const email = text(payload.email).toLowerCase()
  if (!EMAIL.test(email)) throw new Error('Enter a valid email address.')
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (password.length < 8) throw new Error('The temporary password must be at least 8 characters.')

  const fullName = text(payload.fullName)
  const facilityName = text(payload.facilityName)
  const address = text(payload.address)
  const contactNumber = text(payload.contactNumber)
  const city = text(payload.city)
  if (!fullName) throw new Error('Contact name is required.')
  if (!facilityName) throw new Error('Facility name is required.')
  if (!address) throw new Error('Address is required.')
  if (!contactNumber) throw new Error('Contact number is required.')

  const hasPoint = Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude)
  const latitude = hasPoint ? payload.latitude : 0
  const longitude = hasPoint ? payload.longitude : 0
  const hash = hasPoint ? geohash(latitude, longitude, GEOHASH_PRECISION) : ''

  const requestedId = text(payload.hospitalId)
  if (requestedId && !HOSPITAL_ID.test(requestedId)) {
    throw new Error('Facility id must be lowercase letters, numbers and dashes (3-60 characters).')
  }
  const hospitalId =
    requestedId || `${slugify(facilityName) || 'hospital'}-${Math.random().toString(36).slice(2, 6)}`

  const existing = await getDoc(doc(db, 'hospitals', hospitalId))
  if (existing.exists()) throw new Error('A facility with that id already exists.')

  const stale = getApps().find((app) => app.name === SECONDARY_APP)
  if (stale) await deleteApp(stale)
  const secondary = initializeApp(firebaseConfig, SECONDARY_APP)
  const secondaryAuth = getAuth(secondary)

  let created = null
  try {
    created = await createUserWithEmailAndPassword(secondaryAuth, email, password)

    const batch = writeBatch(db)
    batch.set(doc(db, 'users', created.user.uid), {
      role: 'hospital',
      fullName,
      email,
      phoneNumber: contactNumber,
      hospitalId,
      city,
      latitude,
      longitude,
      geohash: hash,
      status: 'Active',
      createdAt: serverTimestamp(),
    })
    batch.set(doc(db, 'hospitals', hospitalId), {
      name: facilityName,
      address,
      contactNumber,
      city,
      latitude,
      longitude,
      geohash: hash,
      status: 'Active',
      createdBy: auth?.currentUser?.uid || 'admin-console',
      createdAt: serverTimestamp(),
    })
    await batch.commit()

    return { uid: created.user.uid, hospitalId }
  } catch (error) {
    // The document write is one atomic batch, so a refusal left nothing behind;
    // only the sign-in record needs undoing.
    if (created?.user) await deleteUser(created.user).catch(() => {})
    throw error
  } finally {
    await signOut(secondaryAuth).catch(() => {})
    await deleteApp(secondary).catch(() => {})
  }
}

/**
 * @param {unknown} error
 * @returns {string} a sentence suitable for the page
 */
export function accountServiceError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const raw = typeof error?.message === 'string' ? error.message : ''
  // The SDK appends `[httpStatus]` to every message. `[0]` means the request
  // produced no readable response: a callable that is not deployed answers 404
  // without CORS headers, which the browser sees as a failed fetch.
  const noResponse = /\[0\]$/.test(raw)
  const message = raw.replace(/\s\[\d+\]$/, '')

  switch (code) {
    case 'functions/not-found':
    case 'functions/unimplemented':
      return NOT_DEPLOYED
    case 'functions/unavailable':
      return 'The account service could not be reached. Check your connection and try again.'
    case 'functions/permission-denied':
      return message || 'Only a signed-in administrator can do that.'
    case 'functions/unauthenticated':
      return 'Your session has expired. Sign in again.'
    case 'functions/invalid-argument':
    case 'functions/failed-precondition':
      return message || 'Check the values and try again.'
    case 'functions/already-exists':
      return message || 'An account or facility with those details already exists.'
    case 'functions/internal':
      return noResponse
        ? NOT_DEPLOYED
        : message || 'The account service failed before it could say why. Nothing was created.'
    // Browser path (D34): Firestore refused the document write, which means the
    // signed-in admin has no `admin` claim yet.
    case 'permission-denied':
      return (
        'Firestore refused the write, so nothing was kept. Your admin account needs the ' +
        '"admin" claim: publish it once with "npm run set:claims", or deploy the account worker.'
      )
    case 'auth/email-already-in-use':
      return 'That email already has an account.'
    case 'auth/invalid-password':
    case 'auth/weak-password':
      return 'Firebase rejected that password. Use a longer one.'
    case 'auth/operation-not-allowed':
      return 'Email and password sign-in is not enabled in the Firebase console.'
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check your connection and try again.'
    default:
      return message || 'That did not work. Check your connection and try again.'
  }
}

/**
 * Create a hospital account: the sign-in record, `users/{uid}` and
 * `hospitals/{hospitalId}` in one step. With `VITE_ACCOUNT_SERVICE_URL` set the
 * worker also publishes the `staff` claim; without it the browser writes the
 * account and the claim stays for the Admin SDK path (D34).
 *
 * @param {{
 *   email: string, password: string, fullName: string,
 *   facilityName: string, address: string, contactNumber: string,
 *   city?: string, latitude?: number|null, longitude?: number|null,
 * }} input
 * @returns {Promise<{ uid: string, hospitalId: string }>}
 */
export async function createHospitalAccount(input) {
  if (SERVICE_URL) return callService('createHospitalAccount', input)
  return createHospitalAccountInBrowser(input)
}

/**
 * Delete the sign-in record for an account whose profile is already `Removed`
 * or `Suspended`. Firestore records are kept for the retention reasons in
 * `docs/PRIVACY_AND_CONSENT.md`. Needs the Admin SDK: a session cannot delete
 * another account, so this requires the worker or the callable.
 *
 * @param {string} uid
 * @returns {Promise<{ uid: string }>}
 */
export async function deleteAuthAccount(uid) {
  if (SERVICE_URL) return callService('deleteAuthAccount', { uid })
  if (!functions) throw new Error('Firebase is not configured.')
  const call = httpsCallable(functions, 'deleteAuthAccount')
  const { data } = await call({ uid })
  return data
}
