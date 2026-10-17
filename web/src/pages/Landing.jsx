import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../theme'
import { authErrorMessage, useAuth } from '../auth'
import { Toast, ToastStack } from './../components'
import { LandingBody } from './LandingBody'
/**
 * Landing page.
 *
 * The markup is generated (`LandingBody.jsx` — never hand-edit it); this file
 * owns the page's behaviour by delegating from the wrapper element, because the
 * generated markup carries no handlers of its own.
 *
 * - Submit on the `#signin` `.pub-form` → a real Firebase sign-in, then the
 *   dashboard. The generated card has nowhere to put an inline message, so
 *   failures surface in the app's `Toast` layer instead.
 * - The three designed CTAs are the page's "get started" affordances and open the
 *   register screen with the matching role preselected:
 *   "Become a donor" → donor, "Request blood" → requester,
 *   "Become a partner" → hospital.
 * - The nav's "Sign in" keeps scrolling to the band, as designed.
 */
const CTA_ROLES = [
  ['.pub-bigcta-actions .pub-btn-light', 'donor'],
  ['.pub-bigcta-actions .pub-btn-line', 'requester'],
  ['.pub-partners-band .pub-btn-ghost', 'hospital'],
]
export default function Landing() {
  const { theme } = useTheme()
  const { signIn } = useAuth()
  const ref = useRef(null)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  // Clear a stale failure after a few seconds so the page settles.
  useEffect(() => {
    if (!error) return undefined
    const timer = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(timer)
  }, [error])
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const onClick = (event) => {
      const target = event.target
      if (target.closest('.pub-nav-end .pub-btn')) {
        document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' })
        return
      }
      const cta = CTA_ROLES.find(([selector]) => target.closest(selector))
      if (cta) navigate(`/register?role=${cta[1]}`)
    }
    const onSubmit = async (event) => {
      const form = event.target.closest('.pub-form')
      if (!form) return
      event.preventDefault()
      // The generated inputs carry no `name`, so read them by type.
      const email = form.querySelector('input[type="email"]')?.value ?? ''
      const password = form.querySelector('input[type="password"]')?.value ?? ''
      const submit = form.querySelector('button[type="submit"]')
      if (submit) submit.disabled = true
      try {
        await signIn(email.trim(), password)
        navigate('/admin/dashboard')
      } catch (failure) {
        setError(authErrorMessage(failure))
        if (submit) submit.disabled = false
      }
    }
    el.addEventListener('click', onClick)
    el.addEventListener('submit', onSubmit)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('submit', onSubmit)
    }
  }, [navigate, signIn])
  return (
    <>
      <LandingBody theme={theme} ref={ref} />
      {error && (
        <ToastStack>
          <Toast icon="alert" role="alert">
            {error}
          </Toast>
        </ToastStack>
      )}
    </>
  )
}
