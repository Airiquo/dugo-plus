import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  CONSENT_PURPOSE,
  CONSENT_SCOPE,
  CONSENT_STATUSES,
  CONSENT_TYPE,
  CONSENT_VERSION,
} from '../utils/consent'
import { readProfile } from './users'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** A stored value that may be a Firestore Timestamp, as a Date or null. */
function asDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return null
}

function text(value) {
  return typeof value === 'string' ? value : ''
}

/**
 * A donor's hospital-access consent, or null when none was ever recorded.
 *
 * The document id is the donor's uid, so both this service and the security
 * rules can read it directly. `status` is the current state; `revokedAt` and
 * `grantedAt` are the audit trail of when each state began.
 *
 * @typedef {{
 *   id: string, donorId: string, consentType: string, consentVersion: string,
 *   scope: string[], purpose: string, status: string,
 *   grantedAt: Date|null, revokedAt: Date|null, revokedReason: string,
 *   recordedBy: string, updatedAt: Date|null,
 * }} Consent
 */

function normalise(snap) {
  const data = snap.data() ?? {}
  const scope = Array.isArray(data.scope)
    ? data.scope.filter((item) => typeof item === 'string')
    : []
  return {
    id: snap.id,
    donorId: text(data.donorId),
    consentType: text(data.consentType),
    consentVersion: text(data.consentVersion),
    scope,
    purpose: text(data.purpose),
    status: CONSENT_STATUSES.includes(data.status) ? data.status : '',
    grantedAt: asDate(data.grantedAt),
    revokedAt: asDate(data.revokedAt),
    revokedReason: text(data.revokedReason),
    recordedBy: text(data.recordedBy),
    updatedAt: asDate(data.updatedAt),
  }
}

/**
 * The signed-in donor's own consent. `null` means "not given", which is the
 * state a donor registered before F11 is in: registration acceptance is not a
 * hospital-access consent.
 *
 * @param {string} uid
 * @returns {Promise<Consent|null>}
 */
export async function readMyConsent(uid) {
  requireDb()
  if (!uid) throw new Error('Sign in again to review your consent.')
  const snap = await getDoc(doc(db, 'donorConsents', uid))
  return snap.exists() ? normalise(snap) : null
}

/**
 * Record the donor's explicit consent for hospital access.
 *
 * Written with `setDoc` rather than `addDoc` because the rules look the record
 * up by the donor's uid. Calling it again after a withdrawal re-grants the
 * same record and starts a new `grantedAt`; the current state and its times
 * are what the record holds.
 *
 * @param {string} uid
 * @returns {Promise<Consent>}
 */
export async function grantConsent(uid) {
  requireDb()
  if (!uid) throw new Error('Sign in again to record your consent.')
  const record = {
    donorId: uid,
    consentType: CONSENT_TYPE,
    consentVersion: CONSENT_VERSION,
    scope: [...CONSENT_SCOPE],
    purpose: CONSENT_PURPOSE,
    status: 'granted',
    grantedAt: serverTimestamp(),
    revokedAt: null,
    revokedReason: '',
    recordedBy: uid,
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'donorConsents', uid), record)
  return {
    ...record,
    id: uid,
    grantedAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Withdraw the donor's consent. The document is kept and only the withdrawal
 * fields change, so a hospital loses access immediately and the audit trail
 * still shows that consent once existed.
 *
 * @param {string} uid
 * @param {string} [reason] short note kept with the withdrawal
 * @returns {Promise<Consent>}
 */
export async function revokeConsent(uid, reason = '') {
  requireDb()
  if (!uid) throw new Error('Sign in again to withdraw consent.')
  const note = typeof reason === 'string' ? reason.trim() : ''
  if (note.length > 500) throw new Error('Keep the reason under 500 characters.')
  await updateDoc(doc(db, 'donorConsents', uid), {
    status: 'revoked',
    revokedAt: serverTimestamp(),
    revokedReason: note,
    updatedAt: serverTimestamp(),
  })
  return readMyConsent(uid)
}

/**
 * Close a consent record when an administrator erases an account (FR-039).
 * Only an administrator may take this path, and the rules allow it to set the
 * withdrawal fields only — never to grant or edit the scope.
 *
 * @param {string} donorId
 * @param {string} reason
 * @returns {Promise<boolean>} whether a record existed and was withdrawn
 */
export async function revokeConsentOnErasure(donorId, reason) {
  requireDb()
  if (!donorId) throw new Error('Choose an account first.')
  const note = typeof reason === 'string' ? reason.trim() : ''
  const snap = await getDoc(doc(db, 'donorConsents', donorId))
  if (!snap.exists()) return false
  await updateDoc(doc(db, 'donorConsents', donorId), {
    status: 'revoked',
    revokedAt: serverTimestamp(),
    revokedReason: note.slice(0, 500),
    updatedAt: serverTimestamp(),
  })
  return true
}

/**
 * An error a hospital screen can render without exposing whether a donor
 * exists: a refused profile read is the same answer for "no consent", "consent
 * withdrawn", "wrong facility" and "no such donor".
 */
export class DonorAccessError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DonorAccessError'
    this.code = code
  }
}

export const CONSENT_DENIED_MESSAGE =
  'This profile cannot be opened. The donor has not agreed to hospital access, or has withdrawn it, or your hospital account is not yet provisioned for donor access. No profile details can be shown; ask the donor to review their consent, or the Dugo+ team to check your account.'

/**
 * Read a donor profile as hospital staff.
 *
 * The gate is in `firestore.rules`, not here: staff may read `users/{uid}` only
 * while `donorConsents/{uid}` is granted, current and complete. This function
 * turns the SDK's `permission-denied` into a sentence a screen can show, so a
 * hospital never sees a raw Firebase error or a half-loaded profile.
 *
 * @param {string} donorId
 * @returns {Promise<import('./users').Profile>}
 */
export async function readDonorForHospital(donorId) {
  requireDb()
  if (!donorId) {
    throw new DonorAccessError('missing-donor', 'Open a donor from a matched request.')
  }
  try {
    const profile = await readProfile(donorId)
    if (!profile) {
      throw new DonorAccessError('not-found', 'That donor record is not available.')
    }
    return profile
  } catch (error) {
    if (error instanceof DonorAccessError) throw error
    if (error?.code === 'permission-denied' || error?.code === 'not-found') {
      throw new DonorAccessError('consent-required', CONSENT_DENIED_MESSAGE)
    }
    throw new DonorAccessError(
      'unavailable',
      'The donor record could not be loaded. Check your connection and try again.',
    )
  }
}
