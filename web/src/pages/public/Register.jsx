import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorMessage } from '../../services/auth'
import AuthLayout, { SELF_SERVE_ROLES } from '../../layout/AuthLayout'
import { Icon } from '../../components'

/**
 * Register screen.
 *
 * No mockup covers registration — the design only has a "Welcome back" card — so
 * this is `AuthLayout` with extra fields, composed from the public classes that
 * already exist. It is also the only screen that asks which account is being
 * made: `/login` renders no picker.
 *
 * The landing page's CTAs link here with a preset — `/register?role=donor`,
 * `?role=hospital` — while "Request blood" opens the plain form, since there is
 * no requester account type.
 *
 * The chosen account type is written to `users/{uid}` in Firestore right after
 * the account is created (`services/users.js`), and a display name is set from
 * the Name field. The picker offers donor and hospital only; an operator grants
 * admin.
 *
 * The sign-in switch sits directly under the primary button, and the provider
 * button below an `or` divider, mirroring `Login` (dressed by `dugo.extras.css`).
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

  // Which account type starts selected: the one in ?role= when the picker
  // actually offers it, donor otherwise. Held in state because clicking a card
  // in `AuthLayout` reports back here and decides what gets stored. Admin is not
  // on offer — it is granted, not picked (see `AuthLayout`).
  const [role, setRole] = useState(() => {
    const requested = params.get('role')
    return SELF_SERVE_ROLES.some((item) => item.id === requested) ? requested : 'donor'
  })

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
    <AuthLayout
      kicker="Create account"
      heading="One account, three roles"
      role={role}
      onRoleChange={setRole}
    >
      <form
        className="pub-card pub-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          run(() => signUp(name.trim(), email.trim(), password, role))
        }}
      >
        <h3>Create your account</h3>
        <p className="pub-muted">Join Dugo+ as a donor or as a hospital.</p>
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
        {message && (
          <p className="pub-msg" data-kind="error" role="alert">
            {message}
          </p>
        )}
        <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
          <Icon name="arrow-right" size={14} />
        </button>
        <p className="pub-form-alt">
          Already have an account? <Link to="/login">Sign in</Link>
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
