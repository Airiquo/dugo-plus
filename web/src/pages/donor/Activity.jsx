import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { listDonorDonations } from '../../services/donations'
import { readHospitals } from '../../services/hospitals'
import {
  eligibilityFor,
  eligibilityTone,
  toDate,
} from '../../utils/eligibility'
import { Badge, Icon } from '../../components'
import { DonorNav } from '../../layout/DonorNav'
import { Link } from 'react-router-dom'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short' })
const YEAR = new Intl.DateTimeFormat('en-PH', { year: 'numeric' })
const FULL = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** `12 Oct` and `2026` for a donation row; empty parts when there is no date. */
function dayParts(value) {
  const date = toDate(value)
  return date
    ? { day: DAY.format(date), year: YEAR.format(date) }
    : { day: '', year: '' }
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

/** Donor donation history and component-aware eligibility guidance. */
export default function Activity() {
  const { theme } = useTheme()
  const { user, profile, loading, roleLoading } = useAuth()

  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({
    status: 'loading',
    donations: [],
    hospitals: new Map(),
  })

  useEffect(() => {
    if (!user?.uid) return
    let current = true
    setState((prev) => ({ ...prev, status: 'loading' }))

    listDonorDonations(user.uid)
      .then(async (donations) => {
        const hospitals = await readHospitals(
          donations.map((donation) => donation.hospitalId),
        )
        if (current) setState({ status: 'ready', donations, hospitals })
      })
      .catch(() => {
        if (current) setState((prev) => ({ ...prev, status: 'error' }))
      })

    return () => {
      current = false
    }
  }, [user?.uid, attempt])

  const lastDonation = state.donations[0] ?? null
  const units = state.donations.reduce(
    (sum, donation) => sum + donation.units,
    0,
  )

  const eligibility = useMemo(
    () =>
      eligibilityFor({
        dateOfBirth: profile?.dateOfBirth,
        lastDonationAt: lastDonation?.donationDate ?? profile?.lastDonationAt,
        intervalDays:
          Number.isFinite(lastDonation?.intervalDays) &&
          lastDonation.intervalDays > 0
            ? lastDonation.intervalDays
            : null,
      }),
    [profile?.dateOfBirth, profile?.lastDonationAt, lastDonation],
  )

  if (loading || roleLoading || !user) {
    return (
      <div
        style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}
      >
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }

  const nextDay = fullDay(eligibility.nextEligibleOn)

  return (
    <div
      className="pub donor-surface"
      data-theme={theme}
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      <DonorNav />

      <main id="top" className="activity-main donation-hub donor-main">
        <header className="activity-head donation-history-heading">
          <p className="donation-eyebrow">Every visit means something</p>
          <h1 className="activity-title">Your donation story.</h1>
          <p className="pub-muted">
            A record of the times you showed up, and a little guidance for what
            comes next.
          </p>
        </header>

        {state.status === 'loading' && (
          <p className="pub-msg">Loading your activity…</p>
        )}

        {state.status === 'error' && (
          <section className="pub-card activity-card" aria-live="polite">
            <p className="pub-msg" data-kind="error" role="alert">
              Your activity could not be loaded. Check your connection and try
              again.
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
                <span className="activity-tile-value">
                  {state.donations.length}
                </span>
                <span className="activity-tile-note">
                  {units === 0
                    ? 'No units recorded'
                    : `${units} ${units === 1 ? 'unit' : 'units'} given`}
                </span>
              </div>
              <div className="activity-tile">
                <span className="activity-tile-label">Units donated</span>
                <span className="activity-tile-value">{units}</span>
                <span className="activity-tile-note">
                  Confirmed by the hospital
                </span>
              </div>
              <div className="activity-tile">
                <span className="activity-tile-label">Next eligible</span>
                <span className="activity-tile-value" data-small>
                  {eligibility.eligible
                    ? 'Ready to give'
                    : nextDay || eligibility.label}
                </span>
                <span className="activity-tile-note">
                  {eligibility.eligible
                    ? 'You can donate now'
                    : eligibility.label}
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
                    {eligibility.eligible
                      ? 'Ready to give'
                      : nextDay || eligibility.label}
                  </span>
                </div>
                {lastDonation && (
                  <p className="activity-last">
                    Based on your last donation:{' '}
                    <strong>
                      {lastDonation.donationTypeName || 'Donation'}
                    </strong>
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
                  <p className="pub-kicker">Donation history</p>
                  <h3>
                    {state.donations.length}{' '}
                    {state.donations.length === 1 ? 'donation' : 'donations'}
                  </h3>
                </div>
              </div>

              {state.donations.length === 0 ? (
                <div className="activity-empty">
                  <strong>No donations yet.</strong>
                  <p>
                    When a hospital confirms your donation, it will appear here.
                    Your first connection starts with a request.
                  </p>
                </div>
              ) : (
                <ol className="activity-list">
                  {state.donations.map((donation) => {
                    const when = dayParts(donation.donationDate)
                    const facility = state.hospitals.get(donation.hospitalId)
                    return (
                      <li className="activity-row" key={donation.id}>
                        <span className="activity-when">
                          <strong>{when.day || '—'}</strong>
                          {when.year}
                        </span>
                        <span className="activity-what">
                          <strong>
                            {donation.donationTypeName || 'Donation'}
                          </strong>
                          <span>
                            {facility?.name || 'Facility not recorded'}
                          </span>
                        </span>
                        <span className="activity-figures">
                          <span className="activity-units">
                            {donation.units}{' '}
                            {donation.units === 1 ? 'unit' : 'units'}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}

              <Link className="donation-text-link" to="/donor/requests">
                Explore your matched requests{' '}
                <Icon name="arrow-right" size={16} />
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
