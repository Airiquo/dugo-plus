/**
 * Donor eligibility, derived from date of birth and the last donation date
 * (FR-010, FR-031). Framework-free and pure so the rule is testable on its own
 * and cannot drift between screens.
 *
 * The status is always computed, never stored as an editable field: a donor
 * must not be able to declare themselves eligible. The final decision belongs
 * to the facility (FR-031), so this is guidance, not a medical determination.
 */

/** Whole blood deferral. Philippine Red Cross uses three months between donations. */
export const DONATION_INTERVAL_DAYS = 90

/** Donor age window. */
export const MIN_AGE = 18
export const MAX_AGE = 65

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole years between a date and now, or null when the date is unusable. */
export function ageOn(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null
  const dob = toDate(dateOfBirth)
  if (!dob || Number.isNaN(dob.getTime())) return null
  let age = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  // Birthday not yet reached this year.
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1
  return age >= 0 ? age : null
}

/** Days between two dates, or null when either is unusable. */
export function daysBetween(from, to) {
  const start = toDate(from)
  const end = toDate(to)
  if (!start || !end) return null
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS)
}

/**
 * The deferral date: the first day a donation is possible again. `null` when
 * there has been no donation to count from.
 */
export function nextEligibleDate(lastDonationAt) {
  const last = toDate(lastDonationAt)
  if (!last) return null
  return new Date(last.getTime() + DONATION_INTERVAL_DAYS * DAY_MS)
}

/** `Date`, a Firestore Timestamp, a millisecond number, or an ISO string. */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

/**
 * Eligibility for a profile.
 *
 * @param {{ dateOfBirth?: unknown, lastDonationAt?: unknown }} profile
 * @param {Date} [now]
 * @returns {{
 *   status: 'unknown'|'underage'|'overage'|'eligible'|'deferred',
 *   eligible: boolean,
 *   label: string,
 *   detail: string,
 *   nextEligibleOn: Date|null,
 * }}
 *
 * `status` is the machine-readable value; `label` and `detail` are the copy the
 * screen renders. `unknown` means the profile is missing the dates needed to
 * decide, which is the normal state for a new account.
 */
export function eligibilityFor({ dateOfBirth, lastDonationAt } = {}, now = new Date()) {
  const age = ageOn(dateOfBirth, now)

  if (age === null) {
    return {
      status: 'unknown',
      eligible: false,
      label: 'Not enough information',
      detail: 'Add your date of birth to see whether you can donate.',
      nextEligibleOn: null,
    }
  }

  if (age < MIN_AGE) {
    return {
      status: 'underage',
      eligible: false,
      label: 'Not yet eligible',
      detail: `Donors must be at least ${MIN_AGE}. You can donate from your ${MIN_AGE}th birthday.`,
      nextEligibleOn: null,
    }
  }

  if (age > MAX_AGE) {
    return {
      status: 'overage',
      eligible: false,
      label: 'Outside the donor age range',
      detail: `The donor age range is ${MIN_AGE} to ${MAX_AGE}. A facility can advise on exceptions.`,
      nextEligibleOn: null,
    }
  }

  const next = nextEligibleDate(lastDonationAt)
  if (next) {
    const daysLeft = daysBetween(now, next)
    if (daysLeft > 0) {
      return {
        status: 'deferred',
        eligible: false,
        label: 'Deferred',
        detail: `You can donate again in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`,
        nextEligibleOn: next,
      }
    }
  }

  return {
    status: 'eligible',
    eligible: true,
    label: 'Eligible',
    detail: next
      ? 'Your last donation was long enough ago. A facility confirms at the donation itself.'
      : 'No donation on record yet. A facility confirms at the donation itself.',
    nextEligibleOn: next,
  }
}
