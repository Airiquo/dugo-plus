import { Navigate, useLocation } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { homeFor } from '../../services/users'
import { LandingBody } from './LandingBody'

/** Public care landing and news; signed-in home visits retain the role redirect. */
export default function Landing() {
  const { theme } = useTheme()
  const { user, loading, role, roleLoading } = useAuth()
  const { pathname } = useLocation()
  if (loading || roleLoading) return <div className="care-route-loading" role="status"><span className="care-mini-mark" /><p>Connecting you to care…</p></div>
  if (user && pathname === '/') {
    if (!user.emailVerified) return <Navigate to="/verify-email" replace />
    return <Navigate to={homeFor(role)} replace />
  }
  return <LandingBody theme={theme} />
}
