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
 * - The three CTAs open the register screen: "Become a donor" and "Become a
 *   partner" preselect their account type, "Request blood" opens the plain
 *   form (there is no requester role to preset).
 */
const CTA_ROLES = [
  ['.pub-bigcta-actions .pub-btn-light', 'donor'],
  ['.pub-bigcta-actions .pub-btn-line', null],
  ['.pub-partners-band .pub-btn-ghost', 'hospital'],
]

export default function Landing() {
  const { theme } = useTheme()
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onClick = (event) => {
      const cta = CTA_ROLES.find(([selector]) => event.target.closest(selector))
      if (!cta) return
      const [, role] = cta
      navigate(role ? `/register?role=${role}` : '/register')
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [navigate])

  return <LandingBody theme={theme} ref={ref} />
}
