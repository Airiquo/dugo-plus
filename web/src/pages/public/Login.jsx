import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorDetail } from '../../services/auth'
import { homeFor } from '../../services/users'
import { validateLogin } from '../../utils/validate'
import AuthLayout from '../../layout/AuthLayout'
import { Icon, GoogleMark, FieldError } from '../../components'

/**
 * Sign-in screen, wearing the shared `AuthLayout` chrome (the band the landing
 * page's design used to carry, now owned by the app).
 *
 * Reached from the guard (`RequireAuth` sends the attempted URL in
 * `location.state.from`) or from a direct link. Google sign-in creates the
 * account on first use, so there is no separate provider to configure.
 *
 * Every field is checked on submit and each message renders under the input it
 * belongs to; a Firebase rejection is routed to the field its code names, and
 * only provider or configuration failures fall back to a card-level message.
 * Unknown accounts and wrong passwords are reported separately, and each of
 * those messages sits next to the "Forgot your password?" recovery link.
 *
 * Card layout: subline, email field, password field with a right-aligned
 * "Forgot your password?" on the label row and a show/hide reveal inside the
 * field, then the primary action, the `or` divider, the Google secondary, and
 * a hairline footer carrying the register link and who can self-register.
 * Class hooks live in `web/src/styles/app.css`.
 */
export default function Login() {
  const { user, role, roleLoading, signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in (e.g. a bookmark to /login) — route by session/role,
  // not by any previous navigation state. This prevents cross-role redirects
  // when switching accounts.
  if (user && !busy && !roleLoading) {
    if (!user.emailVerified) return <Navigate to="/verify-email" replace />
    return <Navigate to={homeFor(role)} replace />
  }

  const run = async (action) => {
    setBusy(true)
    setMessage('')
    setErrors({})
    try {
      const signedIn = await action()
      // An unverified account cannot open a built screen (D5), so it goes to
      // the notice instead. Route by session/role, not by remembered paths.
      navigate(signedIn?.emailVerified === false ? '/verify-email' : '/welcome', { replace: true })
    } catch (error) {
      const detail = authErrorDetail(error)
      if (detail?.field) setErrors({ [detail.field]: detail.message })
      else setMessage(detail?.message ?? '')
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    const found = validateLogin({ email, password })
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    run(() => signIn(email.trim(), password))
  }

  return (
    <AuthLayout kicker="Sign in" heading="One account, three roles">
      <form
        className="pub-card pub-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <h3>Welcome back</h3>
        <p className="pub-muted">Sign in with the email linked to your account.</p>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            placeholder="name@email.com"
            type="email"
            value={email}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(event) => {
              setEmail(event.target.value)
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
            }}
          />
          <FieldError id="login-email-error">{errors.email}</FieldError>
        </label>
        <label>
          <div className="auth-label-row">
            <span>Password</span>
            <Link className="auth-forgot" to="/forgot-password">
              Forgot your password?
            </Link>
          </div>
          <div className="auth-field">
            <input
              autoComplete="current-password"
              placeholder="••••••••"
              type={showPassword ? 'text' : 'password'}
              value={password}
              aria-invalid={Boolean(errors.password) || undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              onChange={(event) => {
                setPassword(event.target.value)
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
              }}
            />
            <button
              type="button"
              className="auth-reveal"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((on) => !on)}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
            </button>
          </div>
          <FieldError id="login-password-error">{errors.password}</FieldError>
        </label>
        {message && (
          <p className="pub-msg" data-kind="error" role="alert">
            {message}
          </p>
        )}
        <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
          <Icon name="arrow-right" size={14} />
        </button>
        <p className="pub-or">or</p>
        <button
          className="pub-btn pub-btn-ghost pub-btn-wide"
          type="button"
          disabled={busy}
          onClick={() => run(() => signInWithGoogle())}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <div className="auth-card-foot">
          New to Dugo+? <Link to="/register">Create an account</Link>
          <p className="pub-fine">
            Hospital and admin accounts are provided by the Dugo+ team.
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
