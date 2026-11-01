/**
 * Hospital-access consent vocabulary (FR-038 / NFR-16).
 *
 * The consent record is one document per donor: `donorConsents/{uid}`. Its
 * id is the donor's uid so the security rules can look it up without a query
 * (a rule cannot run a collection query). Keeping the version here means the
 * text a donor agreed to can be identified later; the same version string is
 * checked in `firestore.rules`, so bumping it invalidates older consents until
 * the donor consents again.
 *
 * Registration acceptance (`privacyConsentAt` on `users/{uid}`) is a separate
 * record: accepting the privacy notice is not the same as agreeing that a
 * hospital may open the donor's profile. No donor is treated as consented
 * because they registered.
 */

/** Version of the hospital-access consent text in `pages/donor/Consent.jsx`. */
export const CONSENT_VERSION = '2026-11-01'

/** The only consent type this screen writes. Match-specific consent is F4's. */
export const CONSENT_TYPE = 'HospitalProfileAccess'

/** Stored purpose code; the readable sentence is on the consent screen. */
export const CONSENT_PURPOSE = 'hospital-donor-matching'

/**
 * The profile fields a hospital may use, as categories rather than field names.
 * The keys are what the rules check with `hasAll`; the labels and detail are
 * what the donor reads before deciding.
 */
export const CONSENT_CATEGORIES = [
  {
    key: 'identity',
    label: 'Name',
    detail: 'So hospital staff know who they are arranging a donation with.',
  },
  {
    key: 'contact',
    label: 'Email and phone number',
    detail: 'So the hospital can contact you about a request you were matched to.',
  },
  {
    key: 'bloodType',
    label: 'Blood type',
    detail: 'So the hospital can confirm your donation is compatible with its request.',
  },
  {
    key: 'age',
    label: 'Date of birth',
    detail: 'So the hospital can check the age and deferral rules that protect your health.',
  },
  {
    key: 'location',
    label: 'City and approximate coordinates',
    detail: 'So the hospital can see that you are near its facility. The coordinates are optional and coarse.',
  },
  {
    key: 'donationHistory',
    label: 'Last donation date',
    detail: 'So the hospital can apply the waiting interval for the donation type.',
  },
]

/** The category keys the rules require on every consent record. */
export const CONSENT_SCOPE = CONSENT_CATEGORIES.map((category) => category.key)

/** Stored states. A missing document is "not given", not a third state. */
export const CONSENT_STATUSES = ['granted', 'revoked']

/** @param {string} status */
export function consentStatusLabel(status) {
  if (status === 'granted') return 'Granted'
  if (status === 'revoked') return 'Withdrawn'
  return 'Not given'
}

/** The badge tone for a stored state, using the shared `data-status` codes. */
export function consentTone(status) {
  if (status === 'granted') return 'active'
  if (status === 'revoked') return 'rejected'
  return 'pending'
}
