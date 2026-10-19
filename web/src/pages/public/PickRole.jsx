import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { homeFor } from '../../services/users'
import AuthLayout from '../../layout/AuthLayout'
import { Icon } from '../../components'

/**
 * Pick the account type for a signed-in account that has no profile yet.
 *
 * Email/password sign-up stores the role as part of registration, so most people
 * never see this screen. Google sign-in has no register step — the session
 * opens on first use — which leaves `users/{uid}` unwritten. `RequireRole`
 * redirects here, the visitor picks once, and `useAuth.claimRole` writes the
 * document, after which the guard lets them through.
 *
 * `/account/role` is a normal route rather than a modal so it can be reached
 * directly and bookmarked; it hands each account to `homeFor()`, so a claimed
 * role lands on its own destination (the admin dashboard, or `/welcome` for
 * donor and hospital) rather than back on whichever guard bounced here.
 */
export default function PickRole() {
  const { user, loading, role, roleLoading, claimRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [selected, setSelected] = useState('donor')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Same one-off centring as `RequireRole` while the session/profile settles.
  if (loading || roleLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (role) return <Navigate to={homeFor(role)} replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await claimRole(selected)
      navigate(homeFor(selected), { replace: true })
    } catch (error) {
      // The role is chosen in `AuthLayout`, not in this form, so there is no
      // field to pin a message to; say what failed and what to do next. A
      // Firestore rejection is not an auth error, so its raw SDK text is not
      // shown — it names a rule, not anything the visitor can act on.
      setMessage(
        'Your account type was not saved. Check your connection and try again, or ask the Dugo+ team for help.',
      )
      if (import.meta.env.DEV) console.error('claimRole failed:', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      kicker="One step left"
      heading="Which account is this?"
      role={selected}
      onRoleChange={setSelected}
    >
      <form className="pub-card pub-form" noValidate onSubmit={submit}>
        <h3>Pick an account type</h3>
        <p className="pub-muted">
          {user.email} is signed in, but Dugo+ does not know what this account is for yet. Choose
          one to continue.
        </p>
        {message && (
          <p className="pub-msg" data-kind="error" role="alert">
            {message}
          </p>
        )}
        <button className="pub-btn pub-btn-wide" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Continue'}
          <Icon name="arrow-right" size={14} />
        </button>
        <p className="pub-form-alt">
          Need admin access? Ask an operator to grant it to this account.
        </p>
        <p className="pub-form-alt">
          Not you? <Link to="/login">Sign in as someone else</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
