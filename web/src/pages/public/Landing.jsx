import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../theme'
import { LandingBody } from './LandingBody'

/**
 * Landing page.
 *
 * The markup is generated (`LandingBody.jsx` — never hand-edit it); this file
 * owns the page's behaviour by delegating from the wrapper element, because the
 * generated markup carries no handlers of its own.
 *
 * - The page carries no form: signing in happens on `/login`, which the nav's
 *   "Sign in" button and the footer's "Admin Login" link open through the router.
 *   `tools/gen_pages.py` rewrites both into the generated body.
 * - The three designed CTAs are the page's "get started" affordances and open the
 *   register screen: "Become a donor" and "Become a partner" preselect their
 *   account type, while "Request blood" opens the plain form — the account types
 *   are donor / hospital / system admin, so there is no requester role to preset.
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
