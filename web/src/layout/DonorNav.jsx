import { Link, useLocation } from 'react-router-dom'
import { PubThemeToggle } from '../components'

/**
 * The donor surface's top navigation.
 *
 * One header shared by every `/donor` screen so the donor can move between
 * home, requests, alerts and privacy. It reuses the public `.pub-nav` chrome
 * (`styles/public.css`); the caller supplies the `.pub` scope and `data-theme`.
 */
export const DONOR_NAV = [
  { to: '/home', label: 'Home' },
  { to: '/donor/requests', label: 'Requests' },
  { to: '/donor/alerts', label: 'Alerts' },
  { to: '/donor/privacy', label: 'Privacy' },
]

export function DonorNav() {
  const { pathname } = useLocation()
  return (
    <header className="pub-nav">
      <Link className="pub-logo" to="/" aria-label="Dugo+ home">
        <span className="pub-mark" aria-hidden="true" />
        <span className="pub-word">
          Dugo<span>+</span>
        </span>
      </Link>
      <nav aria-label="Sections">
        {DONOR_NAV.map((item) => {
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="pub-nav-end">
        <PubThemeToggle />
      </div>
    </header>
  )
}
