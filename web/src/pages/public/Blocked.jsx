import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import AuthLayout from '../../layout/AuthLayout'
import { Icon } from '../../components'

/**
 * Suspended-account notice (D26).
 *
 * Rendered by `layout/RequireAuth.jsx` when the signed-in account's
 * `users/{uid}.status` is `Suspended` (or `Removed`), so every guarded route —
 * donor and admin — stops at this screen. The security boundary is
 * `firestore.rules` (`accountActive()`); this page is the explanation and the
 * only action left: sign out.
 *
 * The account can still read its own profile document (the rules allow that so
 * this screen can name the block), but nothing else.
 */
export default function Blocked() {
  const { user, loading, status, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // An active account has no reason to be here (a stale tab after reactivation,
  // or a hand-typed URL): send it home once the profile read settles.
  const active = status === 'Active'

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking session…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (active) return <Navigate to="/" replace />

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await signOut()
    } catch {
      setError('Signing out failed. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      kicker="Account suspended"
      heading="This account is on hold"
      blurb="A Dugo+ administrator has paused this account, so donor and admin screens are closed to it until it is restored."
    >
      <form className="pub-card pub-form" noValidate onSubmit={(event) => event.preventDefault()}>
        <h3>Access paused</h3>
        <p className="pub-muted">
          {status === 'Removed'
            ? 'This account has been closed by a Dugo+ administrator.'
            : 'This account has been suspended by a Dugo+ administrator.'}{' '}
          You are signed in as {user.email ?? 'this account'}, but its data is no longer
          available.
        </p>
        <p className="pub-fine">
          Think this is a mistake? Contact{' '}
          <a href="mailto:support@dugoplus.ph">support@dugoplus.ph</a> with the address above and
          the team can restore the account.
        </p>
        {error && (
          <p className="pub-msg" data-kind="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="pub-btn pub-btn-wide"
          type="button"
          disabled={busy}
          onClick={run}
        >
          {busy ? 'Signing out…' : 'Sign out'}
          {!busy && <Icon name="arrow-right" size={14} />}
        </button>
        <p className="pub-form-alt">
          <Link to="/">Back to the Dugo+ home page</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
