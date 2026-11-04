import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cx } from '../utils/cx'
import { AccountIdentity } from './AccountIdentity'
import { Icon } from './Icon'
import { Btn } from './Btn'

/** Profile-head popover. `placement="side"` opens beside desktop sidebars and below compact headers. */
export function AccountMenu({ name, photoURL, accountRole, settingsTo, placement = 'bottom', className, ...rest }) {
  const id = useId()
  const trigger = useRef(null), popup = useRef(null)
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const { signOut } = useAuth()
  const navigate = useNavigate()
  function position() {
    const rect = trigger.current.getBoundingClientRect(), panel = popup.current
    const side = placement === 'side' && window.innerWidth > 1024
    panel.style.left = `${Math.max(8, Math.min(side ? rect.right + 12 : rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 8))}px`
    panel.style.top = `${Math.max(8, Math.min(side ? rect.bottom - panel.offsetHeight : rect.bottom + 10, window.innerHeight - panel.offsetHeight - 8))}px`
  }
  function close() { popup.current?.hidePopover(); setOpen(false) }
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open, placement])
  async function leave() {
    if (busy) return
    setBusy(true); setError('')
    try { await signOut(); close(); navigate('/', { replace: true }) }
    catch { setError('Sign out failed. Please try again.'); setBusy(false); requestAnimationFrame(position) }
  }
  return <div className={cx('account-menu', className)} {...rest}>
    <button type="button" ref={trigger} className="account-menu-trigger" aria-label={`Account menu for ${name}`} aria-expanded={open} aria-controls={`${id}-account-menu`} onClick={() => {
      if (popup.current.matches(':popover-open')) close()
      else { popup.current.showPopover(); position(); setOpen(true) }
    }}><AccountIdentity name={name} photoURL={photoURL} role={accountRole} /><Icon name="chevron-down" size={15} /></button>
    <div ref={popup} popover="auto" id={`${id}-account-menu`} className="account-menu-popup" onToggle={event => setOpen(event.newState === 'open')}>
      <nav aria-label="Account options"><Link to={settingsTo} onClick={close}><Icon name="settings" size={17} />Settings</Link><Btn className="signout-action" icon="logout" onClick={leave} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</Btn></nav>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>
}
