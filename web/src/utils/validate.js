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
    return 'That does not look like an email address — check for a missing @ or a typo.'
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
