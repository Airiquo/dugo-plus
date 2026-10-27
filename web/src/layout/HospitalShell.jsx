import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useTheme } from '../hooks/useTheme'
import { useAuth, userName } from '../hooks/useAuth'
import { roleLabel } from '../services/users'

/**
 * The hospital area's own sidebar, so facility staff never see the admin
 * navigation (which links `/admin/*`, a route their account cannot open).
 * Same shell markup and ids as `AppShell`, so the shared stylesheet carries
 * both themes unchanged.
 */
export const HOSPITAL_NAV = [{ slug: 'requests', label: 'Requests', icon: 'list' }]

function Sidebar({ facility }) {
  const { pathname } = useLocation()
  const { user, role, signOut } = useAuth()
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
        ~/signed in as {name}
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
            $ exit
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
 *   the sidebar pill; omitted until the facility document has loaded.
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
