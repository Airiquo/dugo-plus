import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Blocked from '../pages/public/Blocked'

/**
 * Route guard for the signed-in areas: are you signed in, and is the account
 * still open?
 *
 * Waits for Firebase's first auth callback, then either renders `children` or
 * bounces to `/login`, remembering the URL the visitor wanted in
 * `location.state.from` so the sign-in screen can return them there.
 *
 * A suspended account stops here on `pages/public/Blocked` (D26). The check is
 * status-blind while the profile read is still in flight; the rules close every
 * data path in the meantime, so nothing leaks before it lands.
 *
 * The account type is a second, separate gate: `layout/RequireRole.jsx` sits
 * inside this one and checks `role` from `useAuth()`.
 *
 * There is no unconfigured pass-through. Without a project the shell renders
 * `pages/shared/NotConfigured` instead of these routes (see `App.jsx`).
 */
export default function RequireAuth({ children }) {
  const { user, loading, status } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      // No class in the design system centres a bare page, so this one-off
      // layout is inline — the same approach as NotFound.jsx.
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking session…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (status && status !== 'Active') return <Blocked />
  return children
}
