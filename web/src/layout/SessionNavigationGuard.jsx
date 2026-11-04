import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AdminDialog } from '../components/AdminDialog'
import { Btn } from '../components/Btn'

/** Keeps history navigation in the current session until the user chooses to log out. */
export default function SessionNavigationGuard() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const anchoredUid = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const shouldBlock = useCallback(
    ({ historyAction }) => Boolean(user) && historyAction === 'POP',
    [user],
  )
  const blocker = useBlocker(shouldBlock)

  useLayoutEffect(() => {
    if (!user) {
      anchoredUid.current = null
      return
    }
    if (anchoredUid.current === user.uid) return
    anchoredUid.current = user.uid
    // A same-page entry keeps Back inside the router after direct entry or reload.
    navigate(location.pathname + location.search + location.hash, { state: location.state })
  }, [user, location, navigate])

  useEffect(() => {
    if (!user && blocker.state === 'blocked') blocker.reset()
  }, [user, blocker])

  function stay() {
    if (busy) return
    setError('')
    blocker.reset()
  }

  async function leave() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await signOut({ confirmed: true })
      // Discard the blocked history destination and replace it with login.
      blocker.reset()
      navigate('/login', { replace: true })
    } catch {
      setError('Log out failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminDialog
      name="session-history"
      open={Boolean(user) && blocker.state === 'blocked'}
      busy={busy}
      eyebrow="Your session"
      title="Log out of Dugo+?"
      aria-describedby="session-history-description"
      onClose={stay}
    >
      <p id="session-history-description">
        You’re still signed in. Stay on this page, or log out to leave your account.
      </p>
      {error && <p className="pub-msg" data-kind="error" role="alert">{error}</p>}
      <div className="aa-dialog-actions">
        <Btn autoFocus disabled={busy} onClick={stay}>Stay signed in</Btn>
        <Btn variant="primary" disabled={busy} onClick={leave}>
          {busy ? 'Logging out…' : 'Log out'}
        </Btn>
      </div>
    </AdminDialog>
  )
}
