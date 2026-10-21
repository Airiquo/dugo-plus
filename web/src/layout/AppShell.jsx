import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useTheme } from '../hooks/useTheme'
import { useAuth, userName } from '../hooks/useAuth'
import { roleLabel } from '../services/users'
export const NAV = [
  { slug: 'dashboard', screen: 'admin-dashboard', label: 'Dashboard', icon: 'grid' },
  {
    slug: 'blood-requests',
    screen: 'admin-blood-requests',
    label: 'Blood Requests',
    icon: 'list',
    badge: { id: 'nav-urgent-count', status: 'urgent', text: '3' },
  },
  {
    slug: 'donor-matching',
    screen: 'admin-donor-matching',
    label: 'Donor Matching',
    icon: 'target',
  },
  { slug: 'donor-registry', screen: 'admin-donor-registry', label: 'Donor Registry', icon: 'user' },
  { slug: 'inventory', screen: 'admin-inventory', label: 'Inventory', icon: 'box' },
  {
    slug: 'donations-rewards',
    screen: 'admin-donations-rewards',
    label: 'Donations & Rewards',
    icon: 'gift',
  },
  { slug: 'reports', screen: 'admin-reports', label: 'Reports', icon: 'chart' },
  { slug: 'audit-trail', screen: 'admin-audit-trail', label: 'Audit Trail', icon: 'file' },
  { slug: 'settings', screen: 'admin-settings', label: 'Settings', icon: 'settings' },
]
function Sidebar() {
  const { pathname } = useLocation()
  const { user, role, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  // `RequireAuth` guarantees a signed-in user; there is no demo identity to fall
  // back to any more.
  const name = userName(user)
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <aside id="sidebar">
      <div id="sidebar-logo">
        <Link to="/" id="sidebar-logo-name" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="app-mark" aria-hidden="true" />
          dugo<span className="plus">+</span>
        </Link>
        <span id="sidebar-logo-facility" className="pill">
          Tagaytay City Blood Bank, Cavite
        </span>
      </div>
      <div id="sidebar-section-label">{roleLabel(role)}</div>
      <nav id="sidebar-nav" aria-label="Main">
        {NAV.map((item) => {
          const to = `/admin/${item.slug}`
          const active = pathname === to
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
              {item.badge && (
                <span id={item.badge.id} className="badge" data-status={item.badge.status}>
                  {item.badge.text}
                </span>
              )}
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
 * Admin app chrome: the left sidebar only.
 *
 * The mockup's top toolbar (search, emergency, notifications, account chip) is
 * deliberately not carried here — the owner's direction is sidebar-only admin
 * chrome; the account drawer went with it, and sign-out lives in the sidebar.
 * The theme toggle moved down to the sign-out block so both themes stay
 * reachable from the shell.
 */
export function AppShell({ children }) {
  return (
    <div id="app-shell">
      <Sidebar />
      <main id="page-content">{children}</main>
      <div id="overlay-root" />
      <div id="toast-root" />
    </div>
  )
}
