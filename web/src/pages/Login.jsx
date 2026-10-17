import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authErrorMessage, useAuth } from '../auth'
import AuthLayout from '../layout/AuthLayout'
import { Icon } from '../components'

/**
 * Sign-in screen, wearing the shared `AuthLayout` chrome (the band the landing
 * page's design used to carry, now owned by the app).
 *
 * Reached from the guard (`RequireAuth` sends the attempted URL in
 * `location.state.from`) or from a direct link. Google sign-in creates the
 * account on first use, so there is no separate provider to configure.
 *
 * The register switch sits directly under the primary button, and the provider
 * button below an `or` divider — the order visitors expect from other sites
 * (both dressed by `dugo.extras.css`).
 */
export default function Login() {
  const { user, signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Where the guard sent them from; the dashboard by default.
  const from = state?.from?.pathname ?? '/admin/dashboard'

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
        <p className="pub-muted">Sign in to continue to Dugo+</p>
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
          <span>Password</span>
          <input
            autoComplete="current-password"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
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
        <p className="pub-form-alt">
          New to Dugo+? <Link to="/register">Create an account</Link>
        </p>
        <p className="pub-or">or</p>
        <button
          className="pub-btn pub-btn-ghost pub-btn-wide"
          type="button"
          disabled={busy}
          onClick={() => run(() => signInWithGoogle())}
        >
          Continue with Google
        </button>
      </form>
    </AuthLayout>
  )
}
