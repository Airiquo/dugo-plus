import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PubThemeToggle } from '../components/PubThemeToggle'
import { useTheme } from '../theme'

/**
 * The role choices in the sign-in band, mirroring `light/landing.html`.
 *
 * Presentational only: Firebase Auth has no field for a role, so the selection
 * drives the highlight and nothing else. Storing it per user needs Firestore (or
 * custom claims via the Admin SDK) — see README, "Planned: the API".
 */
export const AUTH_ROLES = [
  { id: 'donor', n: '01', icon: 'user', label: 'Donor', note: 'Profile · Alerts · Rewards' },
  {
    id: 'requester',
    n: '02',
    icon: 'droplet',
    label: 'Requester / Family',
    note: 'Submit request',
  },
  { id: 'hospital', n: '03', icon: 'box', label: 'Hospital / Blood Bank', note: 'Dashboard' },
]

/**
 * Chrome shared by the sign-in and register screens.
 *
 * Faithful to the landing page's `#signin` band: the same `.pub-nav` header
 * shell (logo, section nav, theme toggle), the same `.pub-roles` radiogroup, and
 * the form card the page passes as `children`.
 * Everything here is composed from classes that already exist in
 * `styles/public.css`, so these screens add no CSS of their own.
 *
 * `kicker`/`heading`: the band's left-column copy.
 * `role`: which radio starts selected — 'donor' | 'requester' | 'hospital'.
 * `children`: the `.pub-card .pub-form` column.
 */
export default function AuthLayout({ kicker, heading, role = 'hospital', children }) {
  const { theme } = useTheme()
  const [selected, setSelected] = useState(role)

  return (
    <div className="pub" data-theme={theme}>
      <header className="pub-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            Dugo<span>+</span>
          </span>
        </Link>
        <nav aria-label="Sections">
          <Link to="/">Home</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>
      <main id="top">
        <section className="pub-section pub-signin-band">
          <div className="pub-signin-grid">
            <div>
              <p className="pub-kicker">{kicker}</p>
              <h2 className="pub-mono-h">{heading}</h2>
              <p className="pub-muted pub-measure">
                Whether you're giving, asking, or coordinating, Dugo+ meets you where you are.
              </p>
              <div className="pub-roles" role="radiogroup" aria-label="Sign in as">
                {AUTH_ROLES.map((item) => {
                  const on = selected === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      data-on={on ? 'true' : 'false'}
                      onClick={() => setSelected(item.id)}
                    >
                      <span className="pub-role-n">{item.n}</span>
                      <Icon name={item.icon} />
                      <strong>{item.label}</strong>
                      <em>{item.note}</em>
                    </button>
                  )
                })}
              </div>
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}
