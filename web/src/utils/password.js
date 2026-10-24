/**
 * Password policy (NFR-13): at least 8 characters with upper and lower case
 * letters and a digit. Framework-free so the same rule can be reused by any
 * screen.
 */
export const PASSWORD_MIN = 8

/** A sentence a person can act on, or '' when the password passes. */
export function passwordProblem(password, email = '') {
  if (!password) return 'Enter a password.'
  if (password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters for your password.`
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include upper and lower case letters and a number in your password.'
  }
  if (email && password.toLowerCase() === email.toLowerCase()) {
    return 'Your password cannot be the same as your email address.'
  }
  return ''
}
