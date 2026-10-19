import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { authErrorDetail } from '../../services/auth'
import { homeFor } from '../../services/users'
import { PASSWORD_MIN } from '../../utils/password'
import { validateRegister } from '../../utils/validate'
import AuthLayout, { SELF_SERVE_ROLES } from '../../layout/AuthLayout'
import { Icon, GoogleMark, FieldError } from '../../components'

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
 * admin. If that write fails the account still exists, so the screen says so
 * and points at `/account/role` instead of pretending the sign-up finished.
 *
 * Every field is checked on submit and each message renders under its own input,
 * so one submission answers the whole form. The password rule is the same
 * `utils/validate.js` function the policy in `utils/password.js` defines.
 *
 * The sign-in switch sits directly under the primary button, and the provider
 * button below an `or` divider, mirroring `Login` (dressed by `dugo.extras.css`).
 */
export default function Register() {
  // `sessionRole` drives the already-signed-in redirect (the form's own `role`
  // is only what is being picked here, and would mis-route a returning admin).
  const { user, role: sessionRole, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // Set when the account was made but `users/{uid}` was not (see `run`): the
  // form has to stay mounted to show the recovery, since retrying it would
  // only hit "email already in use".
  const [roleMissing, setRoleMissing] = useState(false)

  // Which account type starts selected: the one in ?role= when the picker
  // actually offers it, donor otherwise. Held in state because clicking a card
  // in `AuthLayout` reports back here and decides what gets stored. Admin is not
  // on offer — it is granted, not picked (see `AuthLayout`).
  const [role, setRole] = useState(() => {
    const requested = params.get('role')
    return SELF_SERVE_ROLES.some((item) => item.id === requested) ? requested : 'donor'
  })

  // Already signed in — go straight to where this account type lives (`homeFor`
  // sends admins on to the dashboard, donor/hospital accounts to `/welcome`).
  // `busy` keeps this form mounted while its own sign-up is in flight, so the
  // redirect cannot overtake `updateProfile` (which would briefly greet the
  // user by email prefix) and so a failure still has a form to report itself
  // on; `roleMissing` holds it for the recovery message below.
  if (user && !busy && !roleMissing) return <Navigate to={homeFor(sessionRole)} replace />

  const run = async (action) => {
    setBusy(true)
    setMessage('')
    setErrors({})
    try {
      const created = await action()
      // A fresh email/password account still has to confirm its address
      // (FR-01, NFR-12); the Google flow returns a verified email already, so
      // it goes straight on. The verify screen forwards once the link is in.
      if (created?.emailVerified === false) navigate('/verify-email', { replace: true })
      else navigate(homeFor(role), { replace: true })
    } catch (error) {
      if (error?.roleNotSaved) {
        setRoleMissing(true)
        setMessage('Your account was created, but its account type could not be saved.')
      } else {
        const detail = authErrorDetail(error)
        if (detail?.field) setErrors({ [detail.field]: detail.message })
        else setMessage(detail?.message ?? '')
      }
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    const found = validateRegister({ name, email, password })
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    run(() => signUp(name.trim(), email.trim(), password, role))
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
          submit()
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
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
            }}
          />
          <FieldError id="register-name-error">{errors.name}</FieldError>
        </label>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            placeholder="name@email.com"
            type="email"
            value={email}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            onChange={(event) => {
              setEmail(event.target.value)
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
            }}
          />
          <FieldError id="register-email-error">{errors.email}</FieldError>
        </label>
        <label>
          <span>Password</span>
          <input
            autoComplete="new-password"
            placeholder="••••••••"
            type="password"
            value={password}
            aria-invalid={Boolean(errors.password) || undefined}
            aria-describedby={errors.password ? 'register-password-error' : undefined}
            onChange={(event) => {
              setPassword(event.target.value)
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
            }}
          />
          <FieldError id="register-password-error">{errors.password}</FieldError>
        </label>
        <p className="pub-fine">
          At least {PASSWORD_MIN} characters, with a letter and a number.
        </p>
        {message && (
          <p className="pub-msg" data-kind="error" role="alert">
            {message}
            {roleMissing && (
              <>
                {' '}
                <Link to="/account/role">Choose your account type again.</Link>
              </>
            )}
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
          <GoogleMark />
          Continue with Google
        </button>
      </form>
    </AuthLayout>
  )
}
