import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorMessage } from '../../services/auth'
import { homeFor } from '../../services/users'
import AuthLayout from '../../layout/AuthLayout'
import { Icon } from '../../components'

/**
 * Email-verification notice (FR-01, NFR-12; gate per D5).
 *
 * Registration sends the confirmation link and lands here, and `RequireVerified`
 * routes any unverified session here, so this is the only screen such an account
 * can use. Three things it offers: re-read the user from Firebase ("I've
 * verified"), resend the link, and sign out — the escape hatch for an address
 * the visitor cannot open.
 *
 * The resend is rate-limited by Firebase; a failure is reported in plain
 * language rather than swallowed (NFR-21). This screen has no input of its own,
 * so its messages are card-level by design — there is no field to blame.
 */
export default function VerifyEmail() {
  const { user, loading, role, roleLoading, reloadUser, resendVerification, signOut } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  // A faster poll is not offered: Firebase rate-limits the resend, so the
  // button reports the state instead of the screen hiding it.
  const [resendBusy, setResendBusy] = useState(false)

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking session…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Already confirmed (this screen can be reached by direct URL) — no reason to
  // hold a verified account here. Waits for the profile read so `homeFor` is
  // given a real account type rather than routing through the picker.
  if (user.emailVerified && !roleLoading) return <Navigate to={homeFor(role)} replace />

  /**
   * Where a just-confirmed account goes. `homeFor(null)` is the picker, so when
   * the profile read is still in flight this returns null and the caller leaves
   * the move to the redirect above, which fires once the role lands.
   */
  const home = () => (roleLoading ? null : homeFor(role))

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

  const resend = async () => {
    setResendBusy(true)
    setMessage('')
    setInfo('')
    try {
      await resendVerification()
      setInfo('Confirmation email sent again. Check your inbox and spam folder.')
    } catch (error) {
      setMessage(authErrorMessage(error))
    } finally {
      setResendBusy(false)
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
        {info && (
          <p className="pub-msg" data-kind="info" role="status">
            {info}
          </p>
        )}
        <button
          className="pub-btn pub-btn-wide"
          type="button"
          disabled={busy || resendBusy}
          onClick={() =>
            run(async () => {
              const fresh = await reloadUser()
              if (!fresh.emailVerified) {
                setMessage(
                  "That email is still not verified. Open the link in your inbox, then try again. Check your spam folder too.",
                )
                return
              }
              // A null `home()` means the account type is still loading; the
              // screen's own redirect takes over from there.
              const target = home()
              if (target) navigate(target, { replace: true })
            })
          }
        >
          {busy ? 'Checking…' : "I've verified my email"}
          <Icon name="arrow-right" size={14} />
        </button>
        <button
          className="pub-btn pub-btn-ghost pub-btn-wide"
          type="button"
          disabled={busy || resendBusy}
          onClick={resend}
        >
          {resendBusy ? 'Sending…' : 'Resend confirmation email'}
        </button>
        <p className="pub-form-alt">
          Wrong address, or cannot open the link?{' '}
          <button
            type="button"
            className="auth-forgot"
            disabled={busy || resendBusy}
            onClick={() => signOut()}
          >
            Sign out and use a different email
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
