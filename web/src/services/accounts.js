import { invalidateSessionReads } from "./sessionCache"
import { auth } from '../lib/firebase'
import { ACCOUNT_QUOTA_MESSAGE, accountOperationRequest } from '../utils/accountOperationRequest.js'

/** Privileged account operations use the server's recoverable, audited path. */
const SERVICE_URL = (import.meta.env.VITE_ACCOUNT_SERVICE_URL || '').trim()
const NOT_DEPLOYED =
  'Account changes are temporarily unavailable. Please try again later.'

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
    case 429:
      return 'functions/resource-exhausted'
    case 503:
      return 'functions/unavailable'
    case 412:
      return 'functions/failed-precondition'
    default:
      return 'functions/internal'
  }
}

/** Call the account service using the current administrator's token. */
export async function callAccountService(action, payload) {
  if (!SERVICE_URL) throw serviceError('functions/unavailable', NOT_DEPLOYED)
  const user = auth?.currentUser
  if (!user)
    throw serviceError(
      'functions/unauthenticated',
      'Your session has expired. Sign in again.',
    )
  const token = await user.getIdToken()
  try {
    const result = await accountOperationRequest({
      url: SERVICE_URL,
      actorId: user.uid,
      token,
      action,
      payload,
    })
    invalidateSessionReads("profile:")
    invalidateSessionReads("facility:")
    return result
  } catch (error) {
    throw serviceError(error.code || codeForStatus(error.status), error.message)
  }
}

export function createHospitalAccount(input) {
  return callAccountService('createHospitalAccount', input)
}

/** Fresh admin-only details; the revision prevents overwriting a concurrent edit. */
export async function getAccountProfile(uid, { signal } = {}) {
  if (!SERVICE_URL) throw serviceError('functions/unavailable', NOT_DEPLOYED)
  if (!auth?.currentUser) throw serviceError('functions/unauthenticated', 'Sign in again.')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${SERVICE_URL.replace(/\/$/, '')}/profile?uid=${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.revision)
    throw serviceError(codeForStatus(response.status), data.error || 'Account details could not be loaded. The account service may need an update.')
  return data
}

export function updateAccountProfile(input) {
  return callAccountService('updateAccountProfile', input)
}

export function deleteAuthAccount(uid, reason) {
  return callAccountService('deleteAuthAccount', { uid, reason })
}

export function accountServiceError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const raw = typeof error?.message === 'string' ? error.message : ''
  // The SDK appends `[httpStatus]` to every message. `[0]` means the request
  // produced no readable response: a callable that is not deployed answers 404
  // without CORS headers, which the browser sees as a failed fetch.
  const noResponse = /\[0\]$/.test(raw)
  const message = raw.replace(/\s\[\d+\]$/, '')

  switch (code) {
    case 'functions/resource-exhausted':
    case 'resource-exhausted':
      return ACCOUNT_QUOTA_MESSAGE
    case 'functions/not-found':
    case 'functions/unimplemented':
      return NOT_DEPLOYED
    case 'functions/unavailable':
      return (
        message ||
        'Account changes are temporarily unavailable. Please try again later.'
      )
    case 'functions/permission-denied':
      return message || 'Only a signed-in administrator can do that.'
    case 'functions/unauthenticated':
      return 'Your session has expired. Sign in again.'
    case 'functions/invalid-argument':
    case 'functions/failed-precondition':
      return message || 'Check the values and try again.'
    case 'functions/already-exists':
      return (
        message || 'An account or facility with those details already exists.'
      )
    case 'functions/internal':
      return noResponse
        ? NOT_DEPLOYED
        : message ||
            'The account service could not confirm completion. Retry with the same details to check progress.'
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
      return (
        message || 'That did not work. Check your connection and try again.'
      )
  }
}
