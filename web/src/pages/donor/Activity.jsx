import { SupportContact } from '../../components/SupportContact'
import { TableExport } from '../../components/TableExport'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { listDonorDonations } from '../../services/donations'
import { readHospitals } from '../../services/hospitals'
import { eligibilityFor, toDate } from '../../utils/eligibility'
import { useTableSort } from '../../hooks/useTableSort'
import { sortRows, sortDate } from '../../utils/sortRows'
import { SortControls, BloodlineMark, Icon } from '../../components'
import { DonorNav } from '../../layout/DonorNav'

const dateLabel = (value) => {
  const date = toDate(value)
  return date
    ? date.toLocaleDateString('en-PH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Date not recorded'
}

/** Donation history, expandable visit details, and the donor's next step. */
export default function Activity() {
  const { sort, setSort } = useTableSort()
  const { theme } = useTheme(),
    { user, profile } = useAuth()
  const [attempt, setAttempt] = useState(0),
    [search, setSearch] = useState(''),
    [type, setType] = useState('all')
  const [state, setState] = useState({
    status: 'loading',
    donations: [],
    hospitals: new Map(),
  })
  useEffect(() => {
    if (!user?.uid) return
    let current = true
    setState((previous) => ({ ...previous, status: 'loading' }))
    listDonorDonations(user.uid)
      .then(async (donations) => {
        const hospitals = await readHospitals(
          donations.map((donation) => donation.hospitalId),
        )
        if (current) setState({ status: 'ready', donations, hospitals })
      })
      .catch(() => {
        if (current) setState((previous) => ({ ...previous, status: 'error' }))
      })
    return () => {
      current = false
    }
  }, [user?.uid, attempt])
  const latest = state.donations[0] ?? null
  const units = state.donations.reduce(
    (sum, donation) => sum + donation.units,
    0,
  )
  const eligibility = useMemo(
    () =>
      eligibilityFor({
        dateOfBirth: profile?.dateOfBirth,
        lastDonationAt: latest?.donationDate ?? profile?.lastDonationAt,
        intervalDays: latest?.intervalDays > 0 ? latest.intervalDays : null,
      }),
    [profile?.dateOfBirth, profile?.lastDonationAt, latest],
  )
  const filteredVisits = state.donations.filter(
    (donation) =>
      (type === 'all' || donation.donationTypeId === type) &&
      `${donation.donationTypeName} ${state.hospitals.get(donation.hospitalId)?.name || ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  )
  const visible = sortRows(filteredVisits, { date: row => sortDate(row.donationDate), hospital: row => state.hospitals.get(row.hospitalId)?.name, component: row => row.donationTypeName, units: row => Number(row.units) }[sort.key], sort.direction)
  const years = new Map()
  for (const donation of visible) {
    const year =
      sort.key && sort.key !== 'date' ? 'All donations' : toDate(donation.donationDate)?.getFullYear() || 'Earlier visits'
    if (!years.has(year)) years.set(year, [])
    years.get(year).push(donation)
  }
  const types = [
    ...new Map(
      state.donations
        .filter((donation) => donation.donationTypeId)
        .map((donation) => [
          donation.donationTypeId,
          donation.donationTypeName || 'Donation',
        ]),
    ).entries(),
  ]
  const ready = eligibility.eligible,
    needsProfile = eligibility.status === 'unknown'
  return (
    <div className="pub donor-surface" data-theme={theme}>
      <DonorNav />
      <main id="top" className="donation-hub donation-story donor-main">
        <header className="donation-hub-hero">
          <div>
            <p className="donation-eyebrow">Every visit means something</p>
            <h1>
              A little of you.
              <br />
              <em>A lasting difference.</em>
            </h1>
            <p>
              Your confirmed donations, the places you’ve helped,
              <br className="donation-desktop-break" /> and a clear next step
              for when you’re ready.
            </p>
          </div>
          <div className="donation-hero-note">
            <BloodlineMark bloodType={profile?.bloodType} />
            <div>
              <strong>
                Your blood type.
                <br />
                Someone’s lifeline.
              </strong>
              <p>
                Every connection begins with someone
                <br />
                who chooses to show up.
              </p>
            </div>
          </div>
        </header>
        {state.status === 'loading' && (
          <div className="donation-state" role="status">
            <span className="donation-loading-mark" />
            <h2>Gathering your story</h2>
            <p>Loading your confirmed visits and donation readiness…</p>
          </div>
        )}
        {state.status === 'error' && (
          <div className="donation-state" role="alert">
            <Icon name="alert" size={28} />
            <h2>Your history couldn’t be loaded.</h2>
            <p>
              Check your connection, then try again. Your saved donations are
              still there.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <Icon name="refresh" />
              Try again
            </button>
          </div>
        )}
        {state.status === 'ready' && (
          <>
            <section className="story-stats" aria-label="Your donation summary">
              <div>
                <span className="story-stat-icon">
                  <Icon name="droplet" size={20} />
                </span>
                <div>
                  <p>Confirmed donations</p>
                  <strong>{state.donations.length}</strong>
                  <span>
                    {state.donations.length === 1
                      ? 'A visit that mattered'
                      : 'Times you showed up'}
                  </span>
                </div>
              </div>
              <div>
                <span className="story-stat-icon">
                  <Icon name="check" size={20} />
                </span>
                <div>
                  <p>Units donated</p>
                  <strong>{units}</strong>
                  <span>Recorded by your hospitals</span>
                </div>
              </div>
              <div>
                <span className="story-stat-icon">
                  <Icon name="clock" size={20} />
                </span>
                <div>
                  <p>Most recent visit</p>
                  <strong className="story-stat-date">
                    {latest?.donationDate
                      ? dateLabel(latest.donationDate)
                      : 'Your first is ahead'}
                  </strong>
                  <span>
                    {latest?.donationTypeName || 'Start with a matched request'}
                  </span>
                </div>
              </div>
            </section>
            <div className="story-layout">
              <section className="story-history" aria-label="Donation history">
                <div className="donation-list-heading">
                  <div>
                    <p className="donation-eyebrow">
                      A record of your kindness
                    </p>
                    <h2>Your donation history.</h2>
                  </div>
                  <span className="donation-count">
                    {state.donations.length}{' '}
                    {state.donations.length === 1 ? 'visit' : 'visits'}
                  </span>
                </div>
                {state.donations.length > 0 && (
                  <div className="story-filters">
                    <label className="donation-search">
                      <Icon name="search" size={18} />
                      <input
                        aria-label="Search donation history"
                        placeholder="Search a hospital or donation type"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <label>
                      <span className="story-filter-label">Donation type</span>
                      <span className="app-select">
                        <select
                          aria-label="Filter history by donation type"
                          value={type}
                          onChange={(event) => setType(event.target.value)}
                        >
                          <option value="all">All donation types</option>
                          {types.map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </span>
                    </label>
                  </div>
                )}
                <SortControls name="donor-history" sort={sort} onChange={setSort} defaultLabel="Newest visits first" fields={[{key:"date",label:"Donation date"},{key:"hospital",label:"Hospital"},{key:"component",label:"Donation type"},{key:"units",label:"Units"}]} />
                <TableExport name="donor-donations" title="Your donation history" disabled={state.status !== 'ready'} columns={[
                  {label:'Donation ID',value:row=>row.id},{label:'Date',value:row=>row.donationDate},{label:'Hospital',value:row=>state.hospitals.get(row.hospitalId)?.name || row.hospitalId},
                  {label:'Blood group',value:row=>row.bloodType},{label:'Donation type',value:row=>row.donationTypeName || row.donationTypeId},{label:'Units',value:row=>row.units},
                ]} getRows={scope => scope === 'filtered' ? visible : state.donations} />
                {visible.length > 0 ? (
                  <div className="story-timeline">
                    {[...years].map(([year, donations]) => (
                      <section className="story-year" key={year}>
                        <h3>
                          <span>{year}</span>
                          <span>
                            {donations.length}{' '}
                            {donations.length === 1 ? 'donation' : 'donations'}
                          </span>
                        </h3>
                        <div className="story-year-visits">
                          {donations.map((donation) => {
                            const date = toDate(donation.donationDate),
                              hospital = state.hospitals.get(
                                donation.hospitalId,
                              )
                            return (
                              <details
                                className="story-visit"
                                key={donation.id}
                              >
                                <summary>
                                  <span className="story-visit-date">
                                    <strong>
                                      {date
                                        ? date
                                            .getDate()
                                            .toString()
                                            .padStart(2, '0')
                                        : '—'}
                                    </strong>
                                    <span>
                                      {date
                                        ? date.toLocaleDateString('en-PH', {
                                            month: 'short',
                                          })
                                        : 'Unknown'}
                                    </span>
                                  </span>
                                  <span className="story-visit-copy">
                                    <strong>
                                      {donation.donationTypeName || 'Donation'}
                                    </strong>
                                    <span>
                                      <Icon name="pin" size={13} />
                                      {hospital?.name ||
                                        'Hospital not recorded'}
                                    </span>
                                  </span>
                                  <span className="story-visit-amount">
                                    <strong>
                                      {donation.units}{' '}
                                      {donation.units === 1 ? 'unit' : 'units'}
                                    </strong>
                                    <span>
                                      <Icon name="check" size={12} />
                                      Confirmed
                                    </span>
                                  </span>
                                  <Icon
                                    className="story-visit-caret"
                                    name="chevron-down"
                                    size={17}
                                  />
                                </summary>
                                <div className="story-visit-details">
                                  <div>
                                    <span>Donation date</span>
                                    <strong>
                                      {dateLabel(donation.donationDate)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Blood type</span>
                                    <strong>
                                      {donation.bloodType || 'Not recorded'}
                                    </strong>
                                  </div>
                                  <div className="story-visit-address">
                                    <span>Hospital location</span>
                                    <strong>
                                      {hospital?.address ||
                                        'An address wasn’t recorded for this visit.'}
                                    </strong>
                                  </div>
                                  {donation.confirmedAt && (
                                    <p>
                                      <Icon name="shield" size={14} />
                                      Confirmed by the hospital on{' '}
                                      {dateLabel(donation.confirmedAt)}.
                                    </p>
                                  )}
                                </div>
                              </details>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="donation-state story-empty">
                    <span className="story-empty-icon">
                      <Icon
                        name={state.donations.length ? 'search' : 'droplet'}
                        size={28}
                      />
                    </span>
                    <h3>
                      {state.donations.length
                        ? 'No visits match your search.'
                        : 'Your story is just beginning.'}
                    </h3>
                    <p>
                      {state.donations.length
                        ? 'Try another hospital name or donation type.'
                        : 'When a hospital confirms your first donation, you’ll find the details here. Until then, a connection is a good place to start.'}
                    </p>
                    {state.donations.length ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setSearch('')
                          setType('all')
                        }}
                      >
                        Clear filters
                      </button>
                    ) : (
                      <Link className="btn" data-primary to="/donor/requests">
                        Explore matched requests
                        <Icon name="arrow-right" />
                      </Link>
                    )}
                  </div>
                )}
                {state.donations.length > 0 && (
                  <p className="story-history-note">
                    <Icon name="shield" size={15} />
                    Only donations confirmed by a hospital appear in your
                    history.
                  </p>
                )}
              </section>
              <aside className="story-aside">
                <section className="story-readiness" data-ready={ready}>
                  <div className="story-readiness-top">
                    <span className="story-readiness-icon">
                      <Icon name="shield" size={24} />
                    </span>
                    <span className="story-status">
                      <span />
                      {ready
                        ? 'Ready to help'
                        : needsProfile
                          ? 'Profile needed'
                          : 'Check your readiness'}
                    </span>
                  </div>
                  <p className="donation-eyebrow">Your next chapter</p>
                  <h2>
                    {ready ? (
                      <>
                        Another connection
                        <br />
                        could start with you.
                      </>
                    ) : needsProfile ? (
                      <>
                        A few details.
                        <br />A clearer next step.
                      </>
                    ) : eligibility.status === 'deferred' ? (
                      <>
                        A little rest.
                        <br />
                        Then, another chance.
                      </>
                    ) : (
                      <>
                        Let’s find your
                        <br />
                        next step.
                      </>
                    )}
                  </h2>
                  <p>{eligibility.detail}</p>
                  {!ready && eligibility.nextEligibleOn && (
                    <div className="story-next-date">
                      <span>Next eligible date</span>
                      <strong>{dateLabel(eligibility.nextEligibleOn)}</strong>
                    </div>
                  )}
                  {latest && (
                    <div className="story-last-visit">
                      <Icon name="clock" size={16} />
                      <p>
                        Based on your last{' '}
                        <strong>{latest.donationTypeName || 'donation'}</strong>
                        {latest.donationDate
                          ? ` on ${dateLabel(latest.donationDate)}`
                          : ''}
                        .
                      </p>
                    </div>
                  )}
                  <Link
                    className="btn"
                    data-primary
                    to={needsProfile ? '/home' : '/donor/requests'}
                  >
                    {needsProfile
                      ? 'Complete my profile'
                      : ready
                        ? 'Find where I can help'
                        : 'Explore requests'}
                    <Icon name="arrow-right" />
                  </Link>
                  <small>
                    The hospital confirms your eligibility before every
                    donation.
                  </small>
                </section>
                <div className="story-thank-you">
                  <span className="care-mini-mark" aria-hidden="true" />
                  <p>
                    Thank you for making
                    <br />
                    <strong>room for someone else.</strong>
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        <SupportContact />
      </main>
    </div>
  )
}
