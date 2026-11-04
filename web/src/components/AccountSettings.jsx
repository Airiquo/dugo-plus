import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { cx } from '../utils/cx'
import { Icon } from './Icon'

/** `name` scopes tab IDs. Profile content mounts on first visit and retains edits between tabs; appearance is saved on this device. */
export function AccountSettings({ name, children, className, ...rest }) {
  const [params, setParams] = useSearchParams()
  const active = params.get('tab') === 'appearance' ? 'appearance' : 'profile'
  const [profileVisited, setProfileVisited] = useState(active === 'profile')
  useEffect(() => { if (active === 'profile') setProfileVisited(true) }, [active])
  const { theme, setTheme } = useTheme()
  const tabs = useRef({})
  const choose = (tab) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (tab === 'profile') next.delete('tab')
    else next.set('tab', tab)
    return next
  }, { replace: true })
  return <section className={cx('account-settings', className)} {...rest}>
    <div className="account-settings-tabs tabs" role="tablist" aria-label="Settings">
      {['profile', 'appearance'].map(tab => <button
        key={tab} ref={node => { tabs.current[tab] = node }} type="button" role="tab"
        id={`${name}-${tab}-tab`} aria-controls={`${name}-${tab}-panel`}
        aria-selected={active === tab} tabIndex={active === tab ? 0 : -1}
        className="tab" onClick={() => choose(tab)}
        onKeyDown={event => {
          const next = event.key === 'Home' ? 'profile' : event.key === 'End' ? 'appearance' : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (tab === 'profile' ? 'appearance' : 'profile') : null
          if (next) { event.preventDefault(); choose(next); tabs.current[next]?.focus() }
        }}
      ><Icon name={tab === 'profile' ? 'user' : 'sun'} size={17} />{tab === 'profile' ? 'Profile' : 'Appearance'}</button>)}
    </div>
    <div role="tabpanel" id={`${name}-profile-panel`} aria-labelledby={`${name}-profile-tab`} tabIndex={0} className="account-settings-panel" hidden={active !== 'profile'}>
      {profileVisited && children}
    </div>
    <div role="tabpanel" id={`${name}-appearance-panel`} aria-labelledby={`${name}-appearance-tab`} tabIndex={0} className="account-settings-panel" hidden={active !== 'appearance'}>
      <section className="card settings-appearance">
        <h2>Make yourself at home.</h2><p>Choose how Dugo+ looks on this device.</p>
        <fieldset><legend>Color theme</legend><div className="settings-theme-choices">
          {['light', 'dark'].map(mode => <label key={mode} data-selected={theme === mode}>
            <input type="radio" name={`${name}-theme`} value={mode} checked={theme === mode} onChange={() => setTheme(mode)} />
            <Icon name={mode === 'light' ? 'sun' : 'moon'} size={24} /><span>{mode === 'light' ? 'Light mode' : 'Dark mode'}</span>
          </label>)}
        </div></fieldset><p className="settings-theme-note" role="status">{theme === 'light' ? 'Light' : 'Dark'} mode is active.</p>
      </section>
    </div>
  </section>
}
