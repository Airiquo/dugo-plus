import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { useTheme } from '../hooks/useTheme'
import { useAuth, userName } from '../hooks/useAuth'
import { roleLabel } from '../services/users'

/** Hospital and blood-bank navigation: the full facility workspace. */
export const HOSPITAL_NAV = [
  { slug: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { slug: 'requests', label: 'Requests', icon: 'list' },
  { slug: 'inventory', label: 'Inventory', icon: 'box' },
  { slug: 'inventory-log', label: 'Inventory Log', icon: 'list' },
  { slug: 'map', label: 'Hospital Map', icon: 'map' },
  { slug: 'plan', label: 'Partnership plan', icon: 'file' },
  { slug: 'profile', label: 'Facility profile', icon: 'settings' },
  { slug: 'account', label: 'My profile', icon: 'user' },
]

/**
 * The hospital area's own sidebar, so facility staff never see the admin
 * navigation (which links `/admin/*`, a route their account cannot open).
 * Same shell markup and ids as `AppShell`, so the shared stylesheet carries
 * both themes unchanged.
 */
function Sidebar({ facility }) {
  const { pathname } = useLocation()
  const { user, profile, role, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const name = userName(user)
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <aside id="sidebar">
      <div id="sidebar-logo">
        <Link to="/" id="sidebar-logo-name" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="app-mark" aria-hidden="true" />
          dugo<span className="plus">+</span>
        </Link>
        {facility && (
          <span id="sidebar-logo-facility" className="pill">
            {facility}
          </span>
        )}
      </div>
      <div id="sidebar-section-label">{roleLabel(role)}</div>
      <nav id="sidebar-nav" aria-label="Main">
        {HOSPITAL_NAV.map((item) => {
          const to = `/hospital/${item.slug}`
          const active = pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link
              key={item.slug}
              id={`nav-${item.slug}`}
              className="btn"
              to={to}
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div id="sidebar-signed-in">
        <Link className="sidebar-profile-link" to="/hospital/account" aria-label={`Your profile, ${name}`}><ProfileAvatar src={profile?.photoURL} name={name} /><span>Signed in as {name}</span></Link>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${next} mode`}
            title={`Switch to ${next} mode`}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
          </button>
          <button
            id="sidebar-sign-out"
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}

/**
 * Hospital / blood-bank chrome: sidebar-only, like the admin shell.
 *
 * @param {string} [facility] - the signed-in account's facility name, shown as
 *   the sidebar pill; omitted until the hospital document has loaded.
 */
export function HospitalShell({ children, facility }) {
  return (
    <div id="app-shell">
      <Sidebar facility={facility} />
      <main id="page-content">{children}</main>
      <div id="overlay-root" />
      <div id="toast-root" />
    </div>
  )
}
