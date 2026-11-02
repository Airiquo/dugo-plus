import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useDonorRequests } from '../../hooks/useDonorRequests'
import { useDonorLocation } from '../../hooks/useDonorLocation'
import { DonorNav } from '../../layout/DonorNav'
import { Icon, DonorRequestMap, DonorRequestDetails, BloodlineMark } from '../../components'
import { respondToMatch } from '../../services/matches'
import { listDonationTypes } from '../../services/donationTypes'
import { DEFAULT_INTERVALS, eligibilityFor } from '../../utils/eligibility'
import { donationTypeForComponent, urgencyRank } from '../../utils/matching'
import { missingDonorProfileFields } from '../../utils/profileCompletion'
import {
  componentName,
  enrichRequest,
  isActiveCommitment,
  isAvailableRequest,
  requestDistance,
  directionsUrl,
} from '../../utils/donorRequests'

/** Donor request discovery, one active commitment, and informed responses. */
export default function Requests() {
  const { user, profile } = useAuth(),
    { theme } = useTheme()
  const feed = useDonorRequests(user?.uid),
    position = useDonorLocation(profile)
  const [params, setParams] = useSearchParams(),
    [selectedId, setSelectedId] = useState(null)
  const [mobileView, setMobileView] = useState('list')
  const [tab, setTab] = useState('available'),
    [search, setSearch] = useState(''),
    [component, setComponent] = useState('all'),
    [radius, setRadius] = useState('25')
  const [types, setTypes] = useState(new Map()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [profilePrompt, setProfilePrompt] = useState(false)
  const profileDialog = useRef(null)
  const missingProfileFields = missingDonorProfileFields(profile)
  useEffect(() => {
    const dialog = profileDialog.current
    if (!dialog) return
    if (profilePrompt && !dialog.open) dialog.showModal()
    if (!profilePrompt && dialog.open) dialog.close()
  }, [profilePrompt])
  useEffect(() => {
    let current = true
    listDonationTypes()
      .then((rows) => {
        if (current)
          setTypes(new Map(rows.map((row) => [row.id, row.intervalDays])))
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [])
  const items = useMemo(
    () =>
      feed.items
        .map((item) => enrichRequest(item, position, profile?.bloodType))
        .sort(
          (a, b) =>
            urgencyRank(a.request.urgencyLevel) -
              urgencyRank(b.request.urgencyLevel) ||
            (a.distance ?? Infinity) - (b.distance ?? Infinity),
        ),
    [feed.items, position, profile?.bloodType],
  )
  const commitments = items.filter(isActiveCommitment),
    active = commitments[0]
  const available = items.filter(
    (item) => isAvailableRequest(item) && item.compatible,
  )
  const past = items.filter(
    (item) => !isAvailableRequest(item) && !isActiveCommitment(item),
  )
  const source = tab === 'available' ? available : past
  const visible = source.filter(
    (item) =>
      (component === 'all' || item.request.component === component) &&
      (!Number.isFinite(item.distance) ||
        radius === 'all' ||
        item.distance <= Number(radius)) &&
      `${item.hospital?.name || item.request.hospitalName} ${componentName(item.request.component)} ${item.request.bloodType} ${item.hospital?.address || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const selected = items.find((item) => item.match.id === selectedId)
  useEffect(() => {
    const id = params.get('request')
    if (id && feed.status === 'ready') {
      const item = items.find(
        (item) => item.request.id === id || item.match.id === id,
      )
      if (item) setSelectedId(item.match.id)
    }
  }, [params, feed.status, items])
  const selectedEligibility = selected
    ? eligibilityFor({
        ...profile,
        intervalDays:
          types.get(donationTypeForComponent(selected.request.component)) ||
          DEFAULT_INTERVALS[
            donationTypeForComponent(selected.request.component)
          ] ||
          null,
      })
    : null
  const select = (item) => {
    setSelectedId(item.match.id)
    setError('')
  }
  const close = () => {
    if (busy) return
    setSelectedId(null)
    setError('')
    if (params.has('request')) {
      const next = new URLSearchParams(params)
      next.delete('request')
      setParams(next, { replace: true })
    }
  }
  const respond = async (response, consent = {}) => {
    if (!selected || busy || feed.status !== 'ready') return
    if (response === 'Accepted' && missingProfileFields.length) {
      setProfilePrompt(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      await respondToMatch(
        selected.match.id,
        response,
        response === 'Accepted' && position
          ? { latitude: position.lat, longitude: position.lng }
          : null,
        consent,
      )
      setSelectedId(null)
      const next = new URLSearchParams(params)
      next.delete('request')
      setParams(next, { replace: true })
      setNotice(
        response === 'Accepted'
          ? 'Your donation is planned. Contact the hospital to arrange your visit.'
          : 'Response saved. You can explore other requests when you’re ready.',
      )
    } catch (caught) {
      setError(caught.message)
    } finally {
      setBusy(false)
    }
  }
  const activeUrl = active && directionsUrl(position, active.facility)
  return (
    <div className="pub donor-surface" data-theme={theme}>
      <DonorNav />
      <main id="top" className="donation-hub donor-main">
        <header className="donation-hub-hero">
          <div>
            <p className="donation-eyebrow">Good things start with you</p>
            <h1>
              Your next chance
              <br />
              to <em>make a difference.</em>
            </h1>
            <p>
              Find a request close to you. Know what’s needed.
              <br className="donation-desktop-break" /> Choose one donation you
              can show up for.
            </p>
          </div>
          <div className="donation-hero-note">
            <BloodlineMark bloodType={profile?.bloodType} />
            <div>
              <strong>Your blood type. Someone’s lifeline.</strong>
              <p>
                Requests are matched to your blood type.
                <br />
                You choose when you’re ready.
              </p>
            </div>
          </div>
        </header>
        {notice && (
          <div className="donation-success" role="status">
            <Icon name="check" size={20} />
            <p>{notice}</p>
            <button
              className="btn donation-icon-button"
              type="button"
              aria-label="Dismiss confirmation"
              onClick={() => setNotice('')}
            >
              <Icon name="x" />
            </button>
          </div>
        )}
        {feed.status === 'loading' && (
          <div className="donation-state" role="status">
            <span className="donation-loading-mark" />
            <h2>Finding your connections</h2>
            <p>Loading your matched requests and donation plans…</p>
          </div>
        )}
        {feed.status === 'error' && (
          <div className="donation-state" role="alert">
            <Icon name="alert" size={28} />
            <h2>We couldn’t load your requests.</h2>
            <p>{feed.error}</p>
            <button className="btn" type="button" onClick={feed.retry}>
              <Icon name="refresh" />
              Try again
            </button>
          </div>
        )}
        {feed.status === 'ready' && (
          <>
            {active && (
              <section
                className="donation-commitment"
                aria-label="Your active donation"
              >
                <div className="donation-commitment-mark">
                  <Icon name="check" size={28} />
                </div>
                <div className="donation-commitment-copy">
                  <p className="donation-eyebrow">
                    You’re showing up for someone
                  </p>
                  <h2>Your donation is planned.</h2>
                  <p>
                    <strong>
                      {active.hospital?.name || active.request.hospitalName}
                    </strong>{' '}
                    · {componentName(active.request.component)} ·{' '}
                    {active.request.bloodType}
                  </p>
                  <p className="donation-subtle">
                    Contact the hospital to arrange your visit. You can accept
                    another request after this donation is completed, closed,
                    or you withdraw.
                  </p>
                  {commitments.length > 1 && (
                    <p className="donation-error">
                      You have {commitments.length} earlier commitments. Review
                      your donation plans before making a new one.
                    </p>
                  )}
                </div>
                <div className="donation-commitment-actions">
                  <button
                    className="btn"
                    data-primary
                    type="button"
                    onClick={() => select(active)}
                  >
                    View my donation
                    <Icon name="arrow-right" />
                  </button>
                  {activeUrl && (
                    <a
                      className="donation-text-link"
                      href={activeUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="compass" />
                      Get directions
                    </a>
                  )}
                </div>
              </section>
            )}
            <div
              className="donation-mobile-view"
              role="group"
              aria-label="Request display"
            >
              <button
                type="button"
                aria-pressed={mobileView === 'list'}
                onClick={() => setMobileView('list')}
              >
                <Icon name="list" size={16} />
                Request list
              </button>
              <button
                type="button"
                aria-pressed={mobileView === 'map'}
                onClick={() => setMobileView('map')}
              >
                <Icon name="compass" size={16} />
                Nearby map
              </button>
            </div>
            <div className="donation-workspace" data-mobile-view={mobileView}>
              <section
                className="donation-discovery"
                aria-label="Browse requests"
              >
                <div className="donation-list-heading">
                  <div>
                    <p className="donation-eyebrow">
                      A connection worth making
                    </p>
                    <h2>Find where you can help.</h2>
                  </div>
                  <span className="donation-count">
                    {available.length} matched
                  </span>
                </div>
                <div
                  className="donation-tabs"
                  role="group"
                  aria-label="Request view"
                >
                  <button
                    type="button"
                    aria-pressed={tab === 'available'}
                    onClick={() => setTab('available')}
                  >
                    Available requests<span>{available.length}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={tab === 'past'}
                    onClick={() => setTab('past')}
                  >
                    Past responses<span>{past.length}</span>
                  </button>
                </div>
                <div className="donation-filters">
                  <label className="donation-search">
                    <Icon name="search" size={18} />
                    <input
                      aria-label="Search hospitals or blood components"
                      placeholder="Search hospitals or blood components"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <div>
                    <label>
                      <span>Donation type</span>
                      <span className="app-select">
                        <select
                          value={component}
                          onChange={(event) => setComponent(event.target.value)}
                        >
                          <option value="all">All types</option>
                          {[
                            ...new Set(
                              items.map((item) => item.request.component),
                            ),
                          ].map((type) => (
                            <option key={type} value={type}>
                              {componentName(type)}
                            </option>
                          ))}
                        </select>
                      </span>
                    </label>
                    <label>
                      <span>Distance</span>
                      <span className="app-select">
                        <select
                          value={radius}
                          onChange={(event) => setRadius(event.target.value)}
                        >
                          {[5, 10, 15, 20, 25].map((km) => (
                            <option key={km} value={km}>
                              Within {km} km
                            </option>
                          ))}
                          <option value="all">Any distance</option>
                        </select>
                      </span>
                    </label>
                  </div>
                </div>
                <p className="donation-result-count" aria-live="polite">
                  {visible.length}{' '}
                  {visible.length === 1 ? 'request' : 'requests'}{' '}
                  {tab === 'available'
                    ? 'you can explore'
                    : 'in your past responses'}
                  {active && tab === 'available'
                    ? ' · Your next acceptance unlocks after your current donation.'
                    : ''}
                </p>
                {visible.length ? (
                  <div className="donation-request-list">
                    {visible.map((item) => (
                      <article
                        key={item.match.id}
                        className="donation-request-card"
                        data-urgent={['urgent', 'stat'].includes(
                          item.request.urgencyLevel,
                        )}
                      >
                        <div className="donation-card-top">
                          <span className="donation-blood">
                            {item.request.bloodType}
                          </span>
                          <div>
                            <span className="donation-component">
                              {componentName(item.request.component)}
                            </span>
                            <h3>
                              {item.hospital?.name ||
                                item.request.hospitalName ||
                                'Requesting hospital'}
                            </h3>
                          </div>
                          <span
                            className="donation-priority"
                            data-priority={item.request.urgencyLevel}
                          >
                            {item.request.urgencyLevel === 'stat'
                              ? 'Immediate need'
                              : item.request.urgencyLevel === 'urgent'
                                ? 'Urgent'
                                : 'Routine'}
                          </span>
                        </div>
                        <div className="donation-card-meta">
                          <span>
                            <Icon name="pin" size={15} />
                            {requestDistance(item.distance)}
                          </span>
                          <span>
                            <Icon name="droplet" size={15} />
                            {item.request.quantity}{' '}
                            {item.request.quantity === 1
                              ? 'unit needed'
                              : 'units needed'}
                          </span>
                        </div>
                        <p className="donation-card-address">
                          {item.hospital?.address ||
                            'Contact the hospital for its address.'}
                        </p>
                        <div className="donation-card-footer">
                          <span>
                            {tab === 'past' ? (
                              item.donated ? (
                                'Donation completed'
                              ) : item.request.status === 'cancelled' ? (
                                'Request closed'
                              ) : (
                                item.match.responseStatus
                              )
                            ) : (
                              <>
                                <span className="donation-compatible-dot" />
                                Matched to your blood type
                              </>
                            )}
                          </span>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => select(item)}
                          >
                            View details
                            <Icon name="arrow-right" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="donation-state donation-empty">
                    <Icon name="search" size={30} />
                    <h3>
                      {available.length && tab === 'available'
                        ? 'No requests match these filters.'
                        : tab === 'past'
                          ? 'Your story is just beginning.'
                          : 'You’re all caught up.'}
                    </h3>
                    <p>
                      {tab === 'past'
                        ? 'Your responses and completed requests will appear here.'
                        : 'Try a wider distance, or check back when a new request matches you.'}
                    </p>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setComponent('all')
                        setRadius('all')
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </section>
              <aside className="donation-map-aside">
                <DonorRequestMap
                  items={[...(active ? [active] : []), ...visible]}
                  position={position}
                  activeItem={active}
                  onSelect={select}
                />
                <section className="donation-help-card">
                  <Icon name="shield" size={22} />
                  <h3>Your choice. Your pace.</h3>
                  <p>
                    Browse freely. Your contact details are shared with a
                    hospital only when you accept its request and give consent.
                  </p>
                  <Link to="/donor/privacy">
                    Manage my privacy
                    <Icon name="arrow-right" size={15} />
                  </Link>
                </section>
              </aside>
            </div>
          </>
        )}
        <DonorRequestDetails
          item={selected}
          position={position}
          activeCommitment={active}
          eligibility={selectedEligibility}
          busy={busy}
          error={error}
          onClose={close}
          onRespond={respond}
        />
        <dialog
          ref={profileDialog}
          className="donation-profile-dialog"
          aria-labelledby="donation-profile-dialog-title"
          onCancel={(event) => {
            event.preventDefault()
            setProfilePrompt(false)
          }}
        >
          <div className="donation-profile-dialog-icon"><Icon name="user" size={22} /></div>
          <p className="donation-eyebrow">One quick step first</p>
          <h2 id="donation-profile-dialog-title">Finish your donor profile</h2>
          <p>We need a few details to confirm a safe match before you accept this request.</p>
          <ul>
            {missingProfileFields.map((field) => <li key={field}>{field[0].toUpperCase() + field.slice(1)}</li>)}
          </ul>
          <p className="donation-profile-dialog-note">Phone number and GPS location are optional. Your city is enough.</p>
          <div className="donation-profile-dialog-actions">
            <button className="btn" type="button" onClick={() => setProfilePrompt(false)}>Maybe later</button>
            <Link className="btn" data-primary to="/home" onClick={() => setProfilePrompt(false)}>
              Complete profile <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </dialog>
      </main>
    </div>
  )
}
