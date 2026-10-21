import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleLabel } from '../services/users'

function Centered({ children }) {
  // Same one-off inline centring as `RequireAuth` / `NotFound`, because no class
  // in the design system lays out a bare page.
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: 12 }}>
      {children}
    </div>
  )
}

/**
 * Account-type gate, mounted inside `RequireAuth`.
 *
 * - `role` still loading → wait for the profile read.
 * - no profile after loading → the auto-provision write failed (D20); report
 *   it rather than guessing a role or bouncing the visitor between screens.
 * - profile exists but isn't in `roles` → refuse.
 *
 * `roles` is the list the parent route accepts, e.g. `roles={['admin']}` for
 * `/admin/*`.
 */
export default function RequireRole({ children, roles }) {
  const { user, loading, role, roleLoading, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Centered>
        <p className="pub-msg">Checking session…</p>
      </Centered>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  if (roleLoading) {
    return (
      <Centered>
        <p className="pub-msg">Checking account type…</p>
      </Centered>
    )
  }

  if (!role) {
    return (
      <Centered>
        <p className="pub-msg" data-kind="error" role="alert">
          {user.email ?? 'This account'} is signed in, but its account profile could not be loaded.
          Reload the page, or sign out and back in.
        </p>
        <button
          className="pub-btn pub-btn-ghost"
          type="button"
          onClick={() => signOut()}
        >
          Sign out
        </button>
      </Centered>
    )
  }

  if (roles && !roles.includes(role)) {
    return (
      <Centered>
        <p className="pub-msg" data-kind="error" role="alert">
          {user.email ?? 'This account'} is a {roleLabel(role)} account, but this area needs a{' '}
          {roles.map((item) => roleLabel(item)).join(' or ')} account.
        </p>
        <p>
          <Link to="/">Back to Dugo+</Link>
        </p>
      </Centered>
    )
  }

  return children
}
