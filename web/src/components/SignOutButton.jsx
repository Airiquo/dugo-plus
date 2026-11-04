import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cx } from '../utils/cx'
import { Btn } from './Btn'

/** Signs out the current session and retains an inline retry error on failure. */
export function SignOutButton({ className, ...rest }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div className={cx('profile-signout', className)} {...rest}><Btn type="button" className="signout-action" icon="logout" disabled={busy} onClick={async () => {
    setBusy(true); setError('')
    try { await signOut(); navigate('/', { replace: true }) }
    catch { setError('Sign out failed. Please try again.'); setBusy(false) }
  }}>{busy ? 'Signing out…' : 'Sign out'}</Btn>{error && <p role="alert">{error}</p>}</div>
}
