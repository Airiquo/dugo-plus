import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { cx } from '../utils/cx'
import { Icon } from './Icon'

/** `name` scopes tab IDs. `sections` adds {id,label,icon,content} tabs; `profile=false` omits the profile tab. Visited panels retain drafts. */
export function AccountSettings({ name, children, profile = true, sections = [], className, ...rest }) {
  const [params, setParams] = useSearchParams()
  const choices = [...(profile ? ['profile'] : []), 'appearance', ...sections.map(section => section.id)]
  const active = choices.includes(params.get('tab')) ? params.get('tab') : choices[0]
  const [visited, setVisited] = useState(new Set([active]))
  useEffect(() => { setVisited(previous => new Set([...previous, active])) }, [active])
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
      {choices.map(tab => <button
        key={tab} ref={node => { tabs.current[tab] = node }} type="button" role="tab"
        id={`${name}-${tab}-tab`} aria-controls={`${name}-${tab}-panel`}
        aria-selected={active === tab} tabIndex={active === tab ? 0 : -1}
        className="tab" onClick={() => choose(tab)}
        onKeyDown={event => {
          const next = event.key === 'Home' ? choices[0] : event.key === 'End' ? choices.at(-1) : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? choices[(choices.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length] : null
          if (next) { event.preventDefault(); choose(next); tabs.current[next]?.focus() }
        }}
      ><Icon name={tab === 'profile' ? 'user' : tab === 'appearance' ? 'sun' : sections.find(section => section.id === tab)?.icon} size={17} />{tab === 'profile' ? 'Profile' : tab === 'appearance' ? 'Appearance' : sections.find(section => section.id === tab)?.label}</button>)}
    </div>
    {profile && <div role="tabpanel" id={`${name}-profile-panel`} aria-labelledby={`${name}-profile-tab`} tabIndex={0} className="account-settings-panel" hidden={active !== 'profile'}>
      {profileVisited && children}
    </div>}
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
    {sections.map(section => <div key={section.id} role="tabpanel" id={`${name}-${section.id}-panel`} aria-labelledby={`${name}-${section.id}-tab`} tabIndex={0} className="account-settings-panel" hidden={active !== section.id}>{visited.has(section.id) && section.content}</div>)}
  </section>
}
