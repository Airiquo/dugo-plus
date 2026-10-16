import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useTheme } from '../theme'
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
      <div id="sidebar-section-label">hospital / blood bank</div>
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
        ~/signed in as maria
        <Link id="sidebar-sign-out" to="/">
          $ exit
        </Link>
      </div>
    </aside>
  )
}
function Topbar() {
  const { theme, toggle } = useTheme()
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <header id="topbar">
      <form id="topbar-search" className="field" role="search">
        <label className="sr-only" htmlFor="topbar-search-input">
          Search Dugo+
        </label>
        <input
          id="topbar-search-input"
          placeholder="search requests, donors, inventory"
          type="search"
          name="q"
        />
      </form>
      <button
        className="theme-toggle"
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${next} mode`}
        title={`Switch to ${next} mode`}
      >
        <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
      </button>
      <button id="topbar-emergency-btn" className="btn" type="button" data-status="emergency">
        <Icon name="alert" />
        <span>emergency mode</span>
      </button>
      <button
        id="topbar-notifications"
        className="btn"
        type="button"
        aria-label="Notifications, 5 unread"
      >
        <Icon name="bell" />
        <span className="badge" data-status="new">
          5
        </span>
      </button>
      <button id="topbar-profile" className="btn" type="button">
        <Icon name="user" />
        <span id="topbar-profile-text">
          <span>Maria Santos</span>
          <span>Blood Bank Admin</span>
        </span>
        <Icon name="chevron-down" />
      </button>
    </header>
  )
}
export function AppShell({ children }) {
  return (
    <div id="app-shell">
      <Sidebar />
      <Topbar />
      <main id="page-content">{children}</main>
      <div id="overlay-root" />
      <div id="toast-root" />
    </div>
  )
}
