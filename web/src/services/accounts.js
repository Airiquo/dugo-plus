import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

/**
 * Privileged account operations (FR-040). Creating or deleting a Firebase Auth
 * account needs the Admin SDK, so both are callable functions in `functions/`
 * and the browser never holds a service account.
 *
 * The functions must be deployed for these to work; `accountServiceError()`
 * turns the SDK's failure codes into a sentence that says whether the problem
 * is the deployment, the caller's role, or the input.
 */

/**
 * What the page says when a callable has no deployment behind it. The Functions
 * SDK reports this as `internal [0]` (see `accountServiceError`), so both codes
 * share one sentence and one fallback.
 */
const NOT_DEPLOYED =
  'The account service is not deployed for this project, so nothing was created. ' +
  'Deploying it needs the Blaze plan; until then an administrator can create the ' +
  'hospital account with "npm run create:hospital" from the repo.'

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
    default:
      return message || 'That did not work. Check your connection and try again.'
  }
}

/**
 * Create a hospital account: Auth user, `users/{uid}`, `hospitals/{hospitalId}`
 * and the `staff` custom claim, in one server-side transaction of work.
 *
 * @param {{
 *   email: string, password: string, fullName: string,
 *   facilityName: string, address: string, contactNumber: string,
 *   city?: string, latitude?: number|null, longitude?: number|null,
 * }} input
 * @returns {Promise<{ uid: string, hospitalId: string }>}
 */
export async function createHospitalAccount(input) {
  if (!functions) throw new Error('Firebase is not configured.')
  const call = httpsCallable(functions, 'createHospitalAccount')
  const { data } = await call(input)
  return data
}

/**
 * Delete the sign-in record for an account whose profile is already `Removed`
 * or `Suspended`. Firestore records are kept for the retention reasons in
 * `docs/PRIVACY_AND_CONSENT.md`.
 *
 * @param {string} uid
 * @returns {Promise<{ uid: string }>}
 */
export async function deleteAuthAccount(uid) {
  if (!functions) throw new Error('Firebase is not configured.')
  const call = httpsCallable(functions, 'deleteAuthAccount')
  const { data } = await call({ uid })
  return data
}
