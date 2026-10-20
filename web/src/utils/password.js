/**
 * Password policy (NFR-13): at least 8 characters with a mix of letters and
 * digits. Framework-free so the same rule can be reused by any screen.
 */
export const PASSWORD_MIN = 8

/** A sentence a person can act on, or '' when the password passes. */
export function passwordProblem(password, email = '') {
  if (!password) return 'Enter a password.'
  if (password.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters for your password.`
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include at least one letter and one number in your password.'
  }
  if (email && password.toLowerCase() === email.toLowerCase()) {
    return 'Your password cannot be the same as your email address.'
  }
  return ''
}
