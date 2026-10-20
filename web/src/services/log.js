import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../lib/firebase'

/** Firestore collection error records are written to. */
export const ERROR_LOG_COLLECTION = 'errorLogs'

/** Longest text kept per field, mirroring the caps the security rules enforce. */
const MAX_TEXT = 4000

/** A single line, trimmed to the stored limit. */
function clip(value) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value)
  return text.slice(0, MAX_TEXT)
}

/**
 * One error record, as stored. Every field is a string so the rules can check
 * type without walking nested maps; `build` is the Vite mode, which is how a
 * production report is told apart from a local one.
 *
 * @typedef {{ message: string, stack: string, route: string, uid: string,
 *             build: string, createdAt: unknown }} ErrorRecord
 */

/**
 * Shape a caught value into the stored record, dropping everything else.
 * Anonymous by omission: a signed-out visitor's record carries an empty `uid`.
 *
 * @param {unknown} error
 * @param {{ route?: string }} [context]
 * @returns {ErrorRecord}
 */
export function errorRecord(error, context = {}) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
  return {
    message: clip(message),
    stack: clip(error instanceof Error ? error.stack : ''),
    route: clip(context.route ?? (typeof location !== 'undefined' ? location.pathname : '')),
    uid: clip(auth?.currentUser?.uid ?? ''),
    build: clip(import.meta.env.MODE),
    createdAt: serverTimestamp(),
  }
}

/**
 * Report a caught error. Never throws and never rejects: a failure to log is
 * not a failure of the action that produced the error, so this resolves either
 * way and reports the outcome instead.
 *
 * With no Firebase project there is nowhere to write, which is not an error
 * worth surfacing — the shell shows `NotConfigured` for the missing config.
 *
 * @param {unknown} error
 * @param {{ route?: string }} [context]
 * @returns {Promise<boolean>} whether a record was written
 */
export async function logError(error, context = {}) {
  if (!isFirebaseConfigured || !db) return false
  try {
    await addDoc(collection(db, ERROR_LOG_COLLECTION), errorRecord(error, context))
    return true
  } catch {
    // Reporting failed (offline, rules, quota). Swallowing it is deliberate:
    // throwing here would replace the original error with a logging error.
    return false
  }
}

/** Mark the boundary between console output and Firestore in devtools. */
const TAG = '[dugo:error]'

/**
 * Install the two browser-level report hooks, for the failures a React render
 * boundary cannot see: an async rejection, or an error outside React's tree.
 *
 * Returns a function that removes both, so `main.jsx` can undo it under React's
 * double-invoked effect in development.
 *
 * @returns {() => void}
 */
export function installGlobalErrorReporting() {
  if (typeof window === 'undefined') return () => {}

  const onError = (event) => {
    // The console line is kept beside the Firestore write so a developer sees
    // the failure locally even when nothing is configured to receive it.
    console.error(TAG, event.error ?? event.message)
    logError(event.error ?? event.message, { route: window.location.pathname })
  }

  const onRejection = (event) => {
    console.error(TAG, event.reason)
    logError(event.reason, { route: window.location.pathname })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
