import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorMessage } from '../../services/auth'
import { homeFor } from '../../services/users'
import AuthLayout from '../../layout/AuthLayout'
import { Icon } from '../../components'

/**
 * Email-verification notice (FR-01, NFR-12).
 *
 * Registration sends the confirmation link and lands here. "I've verified"
 * re-reads the user from Firebase, so clicking the emailed link can be
 * confirmed without signing out and back in; an admin reaches the dashboard
 * straight away, donor/hospital accounts go to `homeFor(role)`.
 *
 * The resend is rate-limited by Firebase; a failure is reported in plain
 * language rather than swallowed (NFR-21).
 */
export default function VerifyEmail() {
  const { user, loading, role, reloadUser, resendVerification, signOut } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking session…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const run = async (action) => {
    setBusy(true)
    setMessage('')
    setInfo('')
    try {
      await action()
    } catch (error) {
      setMessage(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout kicker="Verify email" heading="One account, three roles">
      <form className="pub-card pub-form" noValidate onSubmit={(event) => event.preventDefault()}>
        <h3>Confirm your email</h3>
        <p className="pub-muted">
          {user.emailVerified
            ? 'Your email is verified.'
            : `We sent a confirmation link to ${user.email ?? 'your email'}. Open it, then come back and continue.`}
        </p>
        {message && (
          <p className="pub-msg" data-kind="error" role="alert">
            {message}
          </p>
        )}
        {info && <p className="pub-msg">{info}</p>}
        <button
          className="pub-btn pub-btn-wide"
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const fresh = await reloadUser()
              if (fresh.emailVerified) navigate(homeFor(role), { replace: true })
              else setMessage('That email is not verified yet. Open the link in your inbox first.')
            })
          }
        >
          {busy ? 'Checking…' : "I've verified my email"}
          <Icon name="arrow-right" size={14} />
        </button>
        <button
          className="pub-btn pub-btn-ghost pub-btn-wide"
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await resendVerification()
              setInfo('Confirmation email sent again — check your inbox.')
            })
          }
        >
          Resend confirmation email
        </button>
        <p className="pub-form-alt">
          Wrong address?{' '}
          <button
            type="button"
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            onClick={async () => {
              await signOut()
              navigate('/register', { replace: true })
            }}
          >
            Start over
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
