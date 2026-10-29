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
 * @param {unknown} error
 * @returns {string} a sentence suitable for the page
 */
export function accountServiceError(error) {
  const code = error?.code ?? ''
  switch (code) {
    case 'functions/not-found':
    case 'functions/unimplemented':
      return 'The account service is not deployed for this project. An administrator must deploy the Cloud Functions (Blaze plan) before hospital accounts can be created here.'
    case 'functions/unavailable':
      return 'The account service could not be reached. Check your connection and try again.'
    case 'functions/permission-denied':
      return error?.message || 'Only a signed-in administrator can do that.'
    case 'functions/unauthenticated':
      return 'Your session has expired. Sign in again.'
    case 'functions/invalid-argument':
    case 'functions/failed-precondition':
      return error?.message || 'Check the values and try again.'
    case 'functions/already-exists':
      return error?.message || 'An account or facility with those details already exists.'
    case 'functions/internal':
      return error?.message || 'The account service failed. Nothing was changed.'
    default:
      return error?.message || 'That did not work. Check your connection and try again.'
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
