import { Link, useLocation } from 'react-router-dom'
import { Icon, PubThemeToggle, ProfileAvatar } from '../components'
import { useAuth, userName } from '../hooks/useAuth'

export const DONOR_NAV = [
  { to: '/home', label: 'My profile', icon: 'user' },
  { to: '/donor/requests', label: 'Requests', icon: 'droplet' },
  { to: '/donor/activity', label: 'Activity', icon: 'chart' },
  { to: '/donor/alerts', label: 'Alerts', icon: 'bell' },
  { to: '/donor/privacy', label: 'Privacy', icon: 'settings' },
]

/** Donor navigation becomes a bottom bar on small screens. */
export function DonorNav() {
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()
  const name = userName(user)
  return <>
    <a className="care-skip-link" href="#top">Skip to content</a>
    <header className="pub-nav donor-nav">
      <Link className="pub-logo" to="/" aria-label="Dugo+ home"><span className="pub-mark" aria-hidden="true" /><span className="pub-word">dugo<span>+</span></span></Link>
      <nav aria-label="Donor navigation">{DONOR_NAV.map(item => <Link key={item.to} to={item.to} data-active={pathname === item.to ? 'true' : 'false'} aria-current={pathname === item.to ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.label}</span></Link>)}</nav>
      <div className="pub-nav-end"><PubThemeToggle /><Link className="care-avatar" to="/home" aria-label={`Your profile, ${name}`}><ProfileAvatar src={profile?.photoURL} name={name} /></Link><button className="care-signout" type="button" onClick={signOut}>Sign out</button></div>
    </header>
  </>
}
