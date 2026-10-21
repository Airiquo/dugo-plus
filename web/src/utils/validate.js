import { passwordProblem } from './password'

/**
 * Per-field validation for the auth screens (NFR-20, NFR-21).
 *
 * Framework-free and pure: each function returns an object keyed by field name,
 * with a sentence a person can act on. An empty object means the form is valid.
 * Every field is always checked, so a submission answers the whole form at once
 * instead of stopping at the first problem.
 *
 * The screens render these messages under the input they belong to.
 */

/** Deliberately permissive — enough to catch a typo, not to police addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** '' when the address looks usable, otherwise a sentence. */
export function emailProblem(email) {
  const value = (email ?? '').trim()
  if (!value) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value)) {
    return 'That does not look like an email address. Check for a missing @ or a typo.'
  }
  return ''
}

/** Sign-in: both fields, collected together. */
export function validateLogin({ email, password } = {}) {
  const errors = {}
  const emailIssue = emailProblem(email)
  if (emailIssue) errors.email = emailIssue
  if (!password) errors.password = 'Enter your password.'
  return errors
}

/** Registration: name, email, and the shared password policy (NFR-13). */
export function validateRegister({ name, email, password } = {}) {
  const errors = {}
  if (!(name ?? '').trim()) errors.name = 'Enter your name.'
  const emailIssue = emailProblem(email)
  if (emailIssue) errors.email = emailIssue
  const passwordIssue = passwordProblem(password ?? '', (email ?? '').trim())
  if (passwordIssue) errors.password = passwordIssue
  return errors
}

/** Reset request: the address is the only field. */
export function validateForgot({ email } = {}) {
  const errors = {}
  const emailIssue = emailProblem(email)
  if (emailIssue) errors.email = emailIssue
  return errors
}

/**
 * Partner request (D21, `/partner`). A facility asks for a hospital/blood
 * bank account; the form posts to Formspree, so every field is checked here
 * before the request leaves the browser.
 */
export function validatePartner({ facility, contactPerson, email, phone, message } = {}) {
  const errors = {}
  if (!(facility ?? '').trim()) errors.facility = 'Enter the facility or organization name.'
  if (!(contactPerson ?? '').trim()) errors.contactPerson = 'Enter the name we should reply to.'
  const emailIssue = emailProblem(email)
  if (emailIssue) errors.email = emailIssue

  const digits = (phone ?? '').replace(/[\s()-]/g, '')
  if (digits && !/^(\+?\d{7,15})$/.test(digits)) {
    errors.phone = 'Enter a phone number in digits, for example 044 791 0000.'
  }

  if (!(message ?? '').trim()) {
    errors.message = 'Tell us a little about the partnership you are asking for.'
  }

  return errors
}

/**
 * Donor profile (FR-04). Only the fields the user typed are checked; blood type
 * and date of birth are optional at this stage, so a donor can save contact
 * details before deciding.
 *
 * Date of birth is checked for plausibility rather than policy: the age rules
 * live in `utils/eligibility.js`, which reports eligibility instead of blocking
 * the save.
 */
export function validateProfile({ name, phone, dateOfBirth, city } = {}) {
  const errors = {}

  if (!(name ?? '').trim()) {
    errors.name = 'Enter your name so facilities know who is donating.'
  } else if ((name ?? '').trim().length < 2) {
    errors.name = 'That name looks too short.'
  }

  const digits = (phone ?? '').replace(/[\s()-]/g, '')
  if (digits && !/^(\+?\d{7,15})$/.test(digits)) {
    errors.phone = 'Enter a phone number in digits, for example 0917 000 0000.'
  }

  if (dateOfBirth) {
    const dob = new Date(dateOfBirth)
    if (Number.isNaN(dob.getTime())) {
      errors.dateOfBirth = 'That date of birth is not valid.'
    } else if (dob.getTime() > Date.now()) {
      errors.dateOfBirth = 'Date of birth cannot be in the future.'
    } else if (dob.getFullYear() < 1900) {
      errors.dateOfBirth = 'Check the year of birth.'
    }
  }

  // The city is what makes a donor matchable, so it is asked for even though
  // coordinates remain optional.
  if (!(city ?? '').trim()) {
    errors.city = 'Enter your city so nearby requests can reach you.'
  }

  return errors
}
