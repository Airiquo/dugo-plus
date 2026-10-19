import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorMessage } from '../../services/auth'
import AuthLayout from '../../layout/AuthLayout'
import { Icon, GoogleMark } from '../../components'

/**
 * Sign-in screen, wearing the shared `AuthLayout` chrome (the band the landing
 * page's design used to carry, now owned by the app).
 *
 * Reached from the guard (`RequireAuth` sends the attempted URL in
 * `location.state.from`) or from a direct link. Google sign-in creates the
 * account on first use, so there is no separate provider to configure.
 *
 * Card layout: subline, email field, password field with a right-aligned
 * "Forgot your password?" on the label row and a show/hide reveal inside the
 * field, then the primary action, the `or` divider, the Google secondary, and
 * a hairline footer carrying the register link and who can self-register.
 * Class hooks live in `web/src/styles/app.css`.
 */
export default function Login() {
  const { user, signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Where the guard sent them from; the role-aware welcome by default. Cold
  // logins land on `/welcome`, which routes each account type itself — an
  // admin is forwarded on to the dashboard there.
  const from = state?.from?.pathname ?? '/welcome'

  // Already signed in (e.g. a bookmark to /login) — go straight through, but
  // stay put while our own sign-in is still resolving so a failure can be shown
  // instead of being overtaken by the redirect.
  if (user && !busy) return <Navigate to={from} replace />

  const run = async (action) => {
    setBusy(true)
    setMessage('')
    try {
      await action()
      navigate(from, { replace: true })
    } catch (error) {
      setMessage(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout kicker="Sign in" heading="One account, three roles">
      <form
        className="pub-card pub-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          run(() => signIn(email.trim(), password))
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
            onChange={(event) => setEmail(event.target.value)}
          />
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
              onChange={(event) => setPassword(event.target.value)}
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
