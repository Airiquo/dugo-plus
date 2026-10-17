import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'

/**
 * Route guard for the admin shell.
 *
 * - **No project configured** → renders `children` untouched, so a fresh clone
 *   with no `web/.env.local` still reaches every screen (design review stays
 *   friction-free).
 * - Configured → waits for Firebase's first auth callback, then either renders
 *   the shell or bounces to `/login`, remembering the URL the visitor wanted in
 *   `location.state.from` so the sign-in screen can return them there.
 */
export default function RequireAuth({ children }) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) return children

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
  return children
}
