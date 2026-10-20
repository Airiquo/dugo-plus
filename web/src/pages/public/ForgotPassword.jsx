import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorDetail, sendPasswordReset } from '../../services/auth'
import { validateForgot } from '../../utils/validate'
import AuthLayout from '../../layout/AuthLayout'
import { Icon, FieldError } from '../../components'

/**
 * Password-reset screen (FR-48).
 *
 * Sends Firebase's reset email to the address given. The confirmation is
 * deliberately generic — it never reveals whether the address has an account —
 * and system-admin accounts are excluded by design (they are premade and
 * managed by the development team, so no reset email is offered for them).
 *
 * The only local check is that the address is usable; a rejection from Firebase
 * is routed to the email field.
 */
export default function ForgotPassword() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Someone already signed in does not need a reset link.
  if (user) return <Navigate to="/welcome" replace />

  const run = async (event) => {
    event.preventDefault()
    const found = validateForgot({ email })
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (error) {
      const detail = authErrorDetail(error)
      if (detail?.field) setErrors({ [detail.field]: detail.message })
      else setMessage(detail?.message ?? '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      kicker="Reset password"
      heading="One account, three roles"
    >
      <form className="pub-card pub-form" noValidate onSubmit={run}>
        <h3>Recover your account</h3>
        {sent ? (
          <>
            <p className="pub-muted">
              If {email.trim() || 'that address'} has a donor or hospital account, a reset link is on
              its way. Open it to choose a new password.
            </p>
            <Link className="pub-btn pub-btn-wide" to="/login">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="pub-muted">
              Enter your registered email and we'll send a link to set a new password.
            </p>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                placeholder="name@email.com"
                type="email"
                value={email}
                aria-invalid={Boolean(errors.email) || undefined}
                aria-describedby={errors.email ? 'reset-email-error' : undefined}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
                }}
              />
              <FieldError id="reset-email-error">{errors.email}</FieldError>
            </label>
            {message && (
              <p className="pub-msg" data-kind="error" role="alert">
                {message}
              </p>
            )}
            <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
              <Icon name="arrow-right" size={14} />
            </button>
            <p className="pub-form-alt">
              Remembered it? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </form>
    </AuthLayout>
  )
}
