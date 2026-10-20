import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Email-verification gate, mounted inside `RequireAuth`.
 *
 * A confirmed address is required to reach a built screen (FR-01, NFR-12 as
 * decided in D5 — a gate, not the advisory link the requirement text asks for).
 * An unverified session is sent to `/verify-email`, the only screen it can use,
 * which offers a resend, a "I've verified" re-read, and a sign-out.
 *
 * Reads nothing but `emailVerified`. Console-created accounts (admins) are
 * verified by Firebase on creation, so they pass without a role check.
 *
 * `/verify-email` itself is deliberately not wrapped: the gate would otherwise
 * redirect a screen to itself.
 */
export default function RequireVerified({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      // Same one-off inline centring as the other guards; no design-system class
      // lays out a bare page.
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking session…</p>
      </div>
    )
  }

  // Signed out is `RequireAuth`'s call, which sits outside this one.
  if (!user) return children

  if (!user.emailVerified) return <Navigate to="/verify-email" replace />
  return children
}
