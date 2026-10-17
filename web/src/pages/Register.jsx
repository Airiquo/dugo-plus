import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { authErrorMessage, useAuth } from '../auth'
import AuthLayout, { AUTH_ROLES } from '../layout/AuthLayout'
import { Icon } from '../components'

/**
 * Register screen.
 *
 * No mockup covers registration — the design only has a "Welcome back" card — so
 * this is the same `#signin` band with extra fields, composed from the public
 * classes that already exist. The landing page's three CTAs link here with a
 * preset: `/register?role=donor`, `?role=requester`, `?role=hospital`.
 *
 * The role is presentational (see `AuthLayout`); the account itself is created by
 * Firebase Auth, and a display name is set from the Name field.
 */
export default function Register() {
  const { user, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Only honour a ?role= value that exists, so the band never starts with no
  // selection.
  const requested = params.get('role')
  const role = AUTH_ROLES.some((item) => item.id === requested) ? requested : 'donor'

  // Already signed in — go straight through. `busy` keeps this form mounted
  // while its own sign-up is in flight, so the redirect cannot overtake
  // `updateProfile` (which would briefly greet the user by email prefix) and so
  // a failure still has a form to report itself on.
  if (user && !busy) return <Navigate to="/admin/dashboard" replace />

  const run = async (action) => {
    setBusy(true)
    setMessage('')
    try {
      await action()
      navigate('/admin/dashboard', { replace: true })
    } catch (error) {
      setMessage(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout kicker="Create account" heading="One account, three roles" role={role}>
      <form
        className="pub-card pub-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          run(() => signUp(name.trim(), email.trim(), password))
        }}
      >
        <h3>Create your account</h3>
        <p className="pub-muted">Join Dugo+ to give, ask, or coordinate.</p>
        <label>
          <span>Name</span>
          <input
            autoComplete="name"
            placeholder="Maria Santos"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
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
            autoComplete="new-password"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
          <Icon name="arrow-right" size={14} />
        </button>
        {message && (
          <p className="pub-msg" data-kind="error" role="alert">
            {message}
          </p>
        )}
        <button
          className="pub-btn pub-btn-ghost pub-btn-wide"
          type="button"
          disabled={busy}
          onClick={() => run(() => signInWithGoogle())}
        >
          Continue with Google
        </button>
        <p className="pub-msg" data-kind="ok">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
