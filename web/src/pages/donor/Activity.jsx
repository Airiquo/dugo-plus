import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { listDonorDonations } from '../../services/donations'
import { listDonorPoints } from '../../services/rewards'
import { readHospitals } from '../../services/hospitals'
import { eligibilityFor, eligibilityTone, toDate } from '../../utils/eligibility'
import { Badge, Icon, PubThemeToggle } from '../../components'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short' })
const YEAR = new Intl.DateTimeFormat('en-PH', { year: 'numeric' })
const FULL = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })

/** `12 Oct` and `2026` for a donation row; empty parts when there is no date. */
function dayParts(value) {
  const date = toDate(value)
  return date ? { day: DAY.format(date), year: YEAR.format(date) } : { day: '', year: '' }
}

/** `12 Oct 2026`, or '' when there is no date. */
function fullDay(value) {
  const date = toDate(value)
  return date ? FULL.format(date) : ''
}

/** `3 days ago`, for the donation the deferral counts from. */
function agoText(value) {
  const date = toDate(value)
  if (!date) return ''
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / DAY_MS))
  if (days === 0) return 'today'
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/**
 * Donor activity (FR-008, FR-009, FR-010): the donation history, the points it
 * earned, and when the donor can give again.
 *
 * The deferral comes from `utils/eligibility`, the same rule the profile
 * renders (D13); the component of the newest donation supplies its interval.
 * Donations and points are read together so the two lists can never describe
 * different sets of donations.
 */
export default function Activity() {
  const { theme } = useTheme()
  const { user, profile, loading, roleLoading } = useAuth()

  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({
    status: 'loading',
    donations: [],
    points: { entries: [], total: 0 },
    hospitals: new Map(),
  })

  useEffect(() => {
    if (!user?.uid) return
    let current = true
    setState((prev) => ({ ...prev, status: 'loading' }))

    Promise.all([listDonorDonations(user.uid), listDonorPoints(user.uid)])
      .then(async ([donations, points]) => {
        const hospitals = await readHospitals(donations.map((donation) => donation.hospitalId))
        if (current) setState({ status: 'ready', donations, points, hospitals })
      })
      .catch(() => {
        if (current) setState((prev) => ({ ...prev, status: 'error' }))
      })

    return () => {
      current = false
    }
  }, [user?.uid, attempt])

  const lastDonation = state.donations[0] ?? null
  const pointsById = useMemo(
    () => new Map(state.points.entries.map((entry) => [entry.donationId, entry.points])),
    [state.points.entries],
  )
  const units = state.donations.reduce((sum, donation) => sum + donation.units, 0)

const eligibility = useMemo(
  () =>
    eligibilityFor({
      dateOfBirth: profile?.dateOfBirth,
      lastDonationAt: lastDonation?.donationDate ?? profile?.lastDonationAt,
      intervalDays: Number.isFinite(lastDonation?.intervalDays) && lastDonation.intervalDays > 0
        ? lastDonation.intervalDays
        : undefined,
    }),
  [profile?.dateOfBirth, profile?.lastDonationAt, lastDonation],
)

  if (loading || roleLoading || !user) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }

  const nextDay = fullDay(eligibility.nextEligibleOn)

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
          <Link to="/donor/profile">Profile</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>

      <main id="top" className="activity-main">
        <header className="activity-head">
          <p className="pub-kicker">Your activity</p>
          <h1 className="activity-title">Donations &amp; rewards</h1>
          <p className="pub-muted">
            Every confirmed donation, the points it earned, and when you can give again.
          </p>
        </header>

        {state.status === 'loading' && <p className="pub-msg">Loading your activity…</p>}

        {state.status === 'error' && (
          <section className="pub-card activity-card" aria-live="polite">
            <p className="pub-msg" data-kind="error" role="alert">
              Your activity could not be loaded. Check your connection and try again.
            </p>
            <button
              className="pub-btn pub-btn-ghost activity-retry"
              type="button"
              onClick={() => setAttempt((count) => count + 1)}
            >
              <Icon name="refresh" size={14} />
              Try again
            </button>
          </section>
        )}

        {state.status === 'ready' && (
          <>
            <section className="activity-tiles" aria-label="At a glance">
              <div className="activity-tile">
                <span className="activity-tile-label">Donations</span>
                <span className="activity-tile-value">{state.donations.length}</span>
                <span className="activity-tile-note">
                  {units === 0
                    ? 'No units recorded'
                    : `${units} ${units === 1 ? 'unit' : 'units'} given`}
                </span>
              </div>
              <div className="activity-tile">
                <span className="activity-tile-label">Points</span>
                <span className="activity-tile-value">{state.points.total}</span>
                <span className="activity-tile-note">One record per donation</span>
              </div>
              <div className="activity-tile">
                <span className="activity-tile-label">Next eligible</span>
                <span className="activity-tile-value" data-small>
                  {nextDay || eligibility.label}
                </span>
                <span className="activity-tile-note">
                  {eligibility.eligible ? 'You can donate now' : eligibility.label}
                </span>
              </div>
            </section>

            <section className="pub-card activity-card">
              <div className="activity-card-head">
                <div>
                  <p className="pub-kicker">Health tracker</p>
                  <h3>Your next donation</h3>
                </div>
                <Badge data-eligibility={eligibilityTone(eligibility.status)}>
                  {eligibility.label}
                </Badge>
              </div>

              <div className="activity-status">
                <div className="activity-next">
                  <span className="activity-next-label">
                    {nextDay ? 'Next eligible' : 'Eligibility'}
                  </span>
                  <span className="activity-next-value">
                    {nextDay || eligibility.label}
                  </span>
                </div>
                {lastDonation && (
                  <p className="activity-last">
                    Based on your last donation:{' '}
                    <strong>{lastDonation.donationTypeName || 'Donation'}</strong>
                    {lastDonation.donationDate
                      ? ` on ${fullDay(lastDonation.donationDate)} (${agoText(lastDonation.donationDate)})`
                      : ''}
                    .
                  </p>
                )}
              </div>

              <p className="activity-elig-detail">{eligibility.detail}</p>
              <p className="pub-fine">
                A facility confirms eligibility at the donation itself.
              </p>
            </section>

            <section className="pub-card activity-card">
              <div className="activity-card-head">
                <div>
                  <p className="pub-kicker">Donation history &amp; points</p>
                  <h3>
                    {state.donations.length}{' '}
                    {state.donations.length === 1 ? 'donation' : 'donations'}
                  </h3>
                </div>
                {state.donations.length > 0 && (
                  <span className="activity-total">{state.points.total} pts</span>
                )}
              </div>

              {state.donations.length === 0 ? (
                <div className="activity-empty">
                  <strong>No donations yet.</strong>
                  <p>
                    When a facility confirms a donation, it appears here with the points it
                    earned. Until then, your eligibility above is the only thing to check.
                  </p>
                </div>
              ) : (
                <ol className="activity-list">
                  {state.donations.map((donation) => {
                    const when = dayParts(donation.donationDate)
                    const facility = state.hospitals.get(donation.hospitalId)
                    const points = pointsById.get(donation.id)
                    return (
                      <li className="activity-row" key={donation.id}>
                        <span className="activity-when">
                          <strong>{when.day || '—'}</strong>
                          {when.year}
                        </span>
                        <span className="activity-what">
                          <strong>{donation.donationTypeName || 'Donation'}</strong>
                          <span>{facility?.name || 'Facility not recorded'}</span>
                        </span>
                        <span className="activity-figures">
                          <span className="activity-points">
                            {points == null ? 'No points' : `+${points} pts`}
                          </span>
                          <span className="activity-units">
                            {donation.units} {donation.units === 1 ? 'unit' : 'units'}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}

              <p className="pub-fine">
                Points are recorded once per confirmed donation. Tiers and redemption are not
                part of the program yet.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
