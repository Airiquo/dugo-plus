import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme'
import { LandingBody } from './LandingBody'
/**
 * Landing — translated from `light/landing.html`.
 *
 * Behaviour:
 * - Root `.pub` element receives `data-theme={theme}` and a `ref` for delegated
 *   event handling (submit + scroll), mirroring the mockup's inline script.
 * - Delegated listeners only target `.pub-form` (for navigation) and the CTA
 *   buttons (`.pub-nav-end .pub-btn` and `.pub-bigcta-actions button`) to
 *   scroll to `#signin`. Other hash links behave natively.
 * - The pub theme toggle is a React component (`PubThemeToggle`) that swaps the
 *   landing's own `.pub[data-theme]` variable scope alongside the document theme.
 */
export default function Landing() {
  const { theme } = useTheme()
  const ref = useRef(null)
  const navigate = useNavigate()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onClick = (e) => {
      const target = e.target
      if (target.closest('.pub-nav-end .pub-btn, .pub-bigcta-actions button')) {
        document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    const onSubmit = (e) => {
      if (e.target.closest('.pub-form')) {
        e.preventDefault()
        navigate('/admin/dashboard')
      }
    }
    el.addEventListener('click', onClick)
    el.addEventListener('submit', onSubmit)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('submit', onSubmit)
    }
  }, [navigate])
  return <LandingBody theme={theme} ref={ref} />
}
