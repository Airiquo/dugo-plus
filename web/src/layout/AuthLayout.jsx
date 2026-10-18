import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PubThemeToggle } from '../components/PubThemeToggle'
import { useTheme } from '../hooks/useTheme'

/**
 * The account types the register screen offers — donor, hospital, system admin.
 *
 * Presentational only: Firebase Auth has no field for a role, so the selection
 * drives the highlight and nothing else. Storing it per user needs Firestore (or
 * custom claims via the Admin SDK) — see README, "Planned: the API".
 */
export const AUTH_ROLES = [
  { id: 'donor', n: '01', icon: 'user', label: 'Donor', note: 'Profile · Alerts · Rewards' },
  {
    id: 'hospital',
    n: '02',
    icon: 'box',
    label: 'Hospital / Blood Bank',
    note: 'Requests · Inventory',
  },
  {
    id: 'admin',
    n: '03',
    icon: 'settings',
    label: 'System admin',
    note: 'Users · Reports · Audit',
  },
]

/**
 * Chrome shared by the sign-in and register screens.
 *
 * The landing's `#signin` band is the design this is built from, but the band
 * lives here now: the app's landing page carries no form and sends visitors to
 * `/login`, so these screens own the whole shell — the `.pub-nav` header, the
 * `.pub-signin-band` grid, the form card the page passes as `children`, and the
 * landing's `.pub-footer` below it all.
 * Everything is composed from classes that already exist in `styles/public.css`,
 * plus the `.pub-auth` full-height layout hook in `styles/dugo.extras.css`.
 *
 * `kicker`/`heading`: the band's left-column copy.
 * `role`: which account type starts selected. Only the register screen passes
 * one — with no `role` the picker is not rendered at all.
 * `children`: the `.pub-card .pub-form` column.
 */
export default function AuthLayout({ kicker, heading, role, children }) {
  const { theme } = useTheme()
  const [selected, setSelected] = useState(role)

  return (
    <div className="pub pub-auth" data-theme={theme}>
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
                Whether you give blood, coordinate a blood bank, or administer the platform, one
                account covers it.
              </p>
              {role && (
                <div className="pub-roles" role="radiogroup" aria-label="Account type">
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
              )}
            </div>
            {children}
          </div>
        </section>
      </main>
      {/* Same footer as the landing page (see LandingBody.jsx). The Updates form
          has no backend anywhere in the app; it is prevented from reloading the
          page here so the auth screens stay inert. */}
      <footer className="pub-footer">
        <div className="pub-footer-grid">
          <div>
            <Link className="pub-logo" to="/" aria-label="Dugo+ home">
              <span className="pub-mark" aria-hidden="true" />
              <span className="pub-word">
                Dugo<span>+</span>
              </span>
            </Link>
            <p className="pub-muted">
              Real-time blood donor matching
              <br />
              and emergency request platform.
            </p>
          </div>
          <div>
            <p className="pub-kicker">Donor support</p>
            <p>support@dugoplus.ph</p>
            <p>044 791 xxxx</p>
          </div>
          <div>
            <p className="pub-kicker">Hospital partnerships</p>
            <p>partners@dugoplus.ph</p>
            <p>Become a Partner</p>
          </div>
          <form noValidate onSubmit={(event) => event.preventDefault()}>
            <label className="pub-kicker" htmlFor="pub-sub-email">
              Updates
            </label>
            <div className="pub-subscribe">
              <input
                id="pub-sub-email"
                placeholder="Your email address"
                type="email"
                defaultValue=""
              />
              <button className="pub-btn" type="submit">
                Subscribe
              </button>
            </div>
            <p className="pub-fine">By subscribing you agree to receive updates from Dugo+</p>
          </form>
        </div>
        <p className="pub-fine pub-privacy">
          <svg
            className="icon"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>{' '}
          Health data is protected under RA 10173 · access-controlled · consent-based
        </p>
        <div className="pub-footer-end">
          <span>A Donor-First Platform · © 2026 Dugo+. All rights reserved.</span>
          <span>
            Privacy Policy &nbsp; Data Privacy Act &nbsp;
            <Link to="/login">Admin Login</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
