import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
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
 */
const CTA_LINKS = [
  ['.pub-bigcta-actions .pub-btn-light', '/register'],
  ['.pub-bigcta-actions .pub-btn-line', '/register'],
  ['.pub-partners-band .pub-btn-ghost', '/partner'],
]

export default function Landing() {
  const { theme } = useTheme()
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

  return <LandingBody theme={theme} ref={ref} />
}
