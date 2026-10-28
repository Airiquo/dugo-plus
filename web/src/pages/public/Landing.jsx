import { useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { homeFor } from '../../services/users'
import { LandingBody } from './LandingBody'

/**
 * Landing page.
 *
 * The markup lives in `LandingBody.jsx` (seeded from the mockup, editable);
 * this file attaches the behaviour — delegation from the wrapper element,
 * since the body carries no handlers of its own.
 *
 * - No form here: the nav's "Sign in" button and the footer's "Admin Login"
 *   link open `/login` through the router.
 * - "Become a donor" (and "Request blood", since D1 merged receiving into the
 *   donor account) opens the donor-only register screen; "Become a partner"
 *   opens the partnership intake at `/partner` — facilities do not self-
 *   sign-up (D20/D21).
 *
 * Signed-in users are routed to their role-based home immediately so reopening
 * the site or hitting back to `/` does not drop them on the public landing page.
 */
const CTA_LINKS = [
  ['.pub-bigcta-actions .pub-btn-light', '/register'],
  ['.pub-bigcta-actions .pub-btn-line', '/register'],
  ['.pub-partners-band .pub-btn-ghost', '/partner'],
]

export default function Landing() {
  const { theme } = useTheme()
  const { user, loading, role, roleLoading } = useAuth()
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onClick = (event) => {
      const cta = CTA_LINKS.find(([selector]) => event.target.closest(selector))
      if (!cta) return
      const [, to] = cta
      navigate(to)
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [navigate])

  if (loading || roleLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Loading…</p>
      </div>
    )
  }

  if (user) {
    if (!user.emailVerified) return <Navigate to="/verify-email" replace />
    return <Navigate to={homeFor(role)} replace />
  }

  return <LandingBody theme={theme} ref={ref} />
}
