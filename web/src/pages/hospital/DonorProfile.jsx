import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import {
  CONSENT_DENIED_MESSAGE,
  DonorAccessError,
  readDonorForHospital,
} from '../../services/consents'
import { Badge, PubThemeToggle } from '../../components'

/** `29 Oct 2026` from a Date, for the profile's facts. */
function dateLabel(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : value.toDate?.()
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/** Whole years between a date of birth and today, or null. */
function ageFrom(value) {
  if (!value) return null
  const date = value instanceof Date ? value : value.toDate?.()
  if (!date) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const beforeBirthday =
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

/**
 * A donor's profile, opened by hospital staff (FR-038 / NFR-16).
 *
 * The donor is named by router state (`location.state.donorId`), not a URL
 * segment, so an identifier does not land in browser history, the address bar
 * or a server access log. The screen is reached from a matched request; until
 * that hospital screen exists it can be opened with router state only.
 *
 * The gate is in `firestore.rules`: `readDonorForHospital` either returns the
 * profile or a `DonorAccessError` with no distinction between "no consent",
 * "withdrawn", "wrong facility" and "no such donor". The screen renders that
 * refusal as one message rather than guessing which is true.
 *
 * Chrome: hospital accounts have no `AppShell`, so this carries the donor and
 * public screens' `.pub` scope, which is what makes both themes work.
 */
export default function DonorProfile() {
  const { theme } = useTheme()
  const { signOut } = useAuth()
  const location = useLocation()
  const donorId = typeof location.state?.donorId === 'string' ? location.state.donorId : ''
  const requestName =
    typeof location.state?.requestName === 'string' ? location.state.requestName : ''

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(donorId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!donorId) {
      setLoading(false)
      setError(null)
      return undefined
    }
    let current = true
    setLoading(true)
    setError(null)
    readDonorForHospital(donorId)
      .then((found) => {
        if (current) setProfile(found)
      })
      .catch((failure) => {
        if (!current) return
        setProfile(null)
        setError(
          failure instanceof DonorAccessError
            ? failure
            : new DonorAccessError(
                'unavailable',
                'The donor record could not be loaded. Check your connection and try again.',
              ),
        )
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [donorId])

  const age = ageFrom(profile?.dateOfBirth)

  return (
    <div
      className="pub"
      data-theme={theme}
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      <header className="pub-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            Dugo<span>+</span>
          </span>
        </Link>
        <nav aria-label="Sections">
          <Link to="/welcome">Home</Link>
          <Link to="/privacy">Privacy notice</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>

      <main id="top" className="profile-main">
        <article className="pub-card pub-form profile-card hospital-donor">
          <p className="pub-kicker">Hospital access</p>
          <h3>Donor profile</h3>

          {!donorId && (
            <>
              <p className="pub-muted">
                This screen opens from a matched blood request. Dugo+ does not publish a donor
                directory, so there is no list to browse and no address to type.
              </p>
              <div className="hospital-donor-state" data-state="empty">
                <strong>No donor selected</strong>
                <span>
                  Open a donor from a request you have been matched to. The identifier is passed to
                  this screen directly instead of being put in the address bar.
                </span>
              </div>
              <div className="profile-actions">
                <Link className="pub-btn pub-btn-ghost pub-btn-wide" to="/welcome">
                  Back to your account
                </Link>
              </div>
            </>
          )}

          {donorId && loading && (
            <p className="pub-msg" role="status">
              Checking the donor&apos;s consent and loading the profile…
            </p>
          )}

          {donorId && !loading && error && (
            <>
              <div className="hospital-donor-state" data-state="denied" role="alert">
                <strong>
                  {error.code === 'unavailable' ? 'Profile unavailable' : 'Consent required'}
                </strong>
                <span>
                  {error.code === 'unavailable' ? error.message : CONSENT_DENIED_MESSAGE}
                </span>
              </div>
              <p className="pub-fine">
                A refusal here is deliberate and does not confirm whether a donor exists. It means
                the donor has not consented (or has withdrawn), or your account is not provisioned
                for donor access. A hospital cannot browse donors, so there is no list to fall back
                on.
              </p>
              <div className="profile-actions">
                <Link className="pub-btn pub-btn-ghost pub-btn-wide" to="/welcome">
                  Back to your account
                </Link>
              </div>
            </>
          )}

          {donorId && !loading && !error && profile && (
            <>
              <div className="hospital-donor-head">
                <div>
                  <h4>{profile.fullName || 'Donor'}</h4>
                  <p className="pub-muted">
                    {requestName
                      ? `Shared for the request: ${requestName}.`
                      : 'Shared for a blood request your facility is matching.'}
                  </p>
                </div>
                <Badge data-status="active">Consent on file</Badge>
              </div>

              <dl className="hospital-donor-facts">
                <div>
                  <dt>Blood type</dt>
                  <dd>{profile.bloodType || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Age</dt>
                  <dd>
                    {age === null ? 'Not recorded' : `${age}`}
                    {profile.dateOfBirth && (
                      <span className="hospital-donor-sub">Born {dateLabel(profile.dateOfBirth)}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{profile.city || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Last donation</dt>
                  <dd>{profile.lastDonationAt ? dateLabel(profile.lastDonationAt) : 'None recorded'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>
                    {profile.phoneNumber ? (
                      <a href={`tel:${profile.phoneNumber}`}>{profile.phoneNumber}</a>
                    ) : (
                      'Not recorded'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    {profile.email ? (
                      <a href={`mailto:${profile.email}`}>{profile.email}</a>
                    ) : (
                      'Not recorded'
                    )}
                  </dd>
                </div>
              </dl>

              <div className="hospital-donor-consent">
                <strong>Only the fields above were shared.</strong>
                <p>
                  The donor agreed to hospital access to identity, contact details, blood type, date
                  of birth, city and donation date. They can withdraw at any time; this screen then
                  stops loading. Do not copy these details into another system.
                </p>
              </div>

              <div className="profile-actions">
                <Link className="pub-btn pub-btn-ghost pub-btn-wide" to="/welcome">
                  Back to your account
                </Link>
                <button
                  className="pub-btn pub-btn-ghost pub-btn-wide"
                  type="button"
                  onClick={() => signOut()}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </article>
      </main>
    </div>
  )
}
