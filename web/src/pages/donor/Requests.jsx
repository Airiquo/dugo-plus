import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { PubThemeToggle, Icon } from '../../components'
import { listenDonorMatches, respondToMatch } from '../../services/matches'
import { getBloodRequest } from '../../services/requests'
import { getHospital } from '../../services/hospitals'
import { createConsent } from '../../services/consents'
import { listGuidelines } from '../../services/guidelines'
import { getSystemConfig, DEFAULT_RADIUS_TIERS } from '../../services/systemConfig'
import { listDonationTypes } from '../../services/donationTypes'
import { readProfile } from '../../services/users'
import { canDonateTo } from '../../utils/compatibility'
import { eligibilityFor } from '../../utils/eligibility'
import { distanceKm } from '../../utils/geo'

const CONSENT_DATA_SHARING = {
  type: 'Data Sharing',
  title: 'Data Sharing Consent',
  text: 'I consent to the sharing of my current location and the contact details needed for this donation with the requesting hospital and its staff, for the purpose of coordinating the donation.',
}

const CONSENT_SCREENING = {
  type: 'Screening',
  title: 'Screening Consent',
  text: 'I consent to undergo pre-donation screening and eligibility assessment at the facility, and to the recording of the outcome in my donation history.',
}

/** A circular marker so the pins read as facilities/people, not map pins. */
function dotIcon({ color, size = 16, ring = 'rgba(0,0,0,0.25)' }) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 0 3px ${ring};"></span>`,
  })
}

const HOSPITAL_ICON = dotIcon({ color: '#c0392b', size: 18 })
const RECIPIENT_ICON = dotIcon({ color: '#8e44ad', size: 14 })
const ME_ICON = dotIcon({ color: '#1f6feb', size: 16, ring: 'rgba(31,111,235,0.35)' })

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** `https://www.openstreetmap.org/directions` needs no key (D4). */
function directionsUrl(from, to) {
  if (!from || !to) return ''
  return `https://www.openstreetmap.org/directions?route=${from[0]},${from[1]};${to[0]},${to[1]}`
}

export default function Requests() {
  const { theme } = useTheme()
  const { user, loading, role, roleLoading } = useAuth()
  const mapRef = useRef(null)

  const [matches, setMatches] = useState([])
  const [requestsById, setRequestsById] = useState({})
  const [hospitalsById, setHospitalsById] = useState({})
  const [donationTypes, setDonationTypes] = useState([])
  const [profile, setProfile] = useState(null)
  const [radiusTiers, setRadiusTiers] = useState(DEFAULT_RADIUS_TIERS)
  const [filterBlood, setFilterBlood] = useState('compatible')
  const [filterComponent, setFilterComponent] = useState('all')
  const [filterRadius, setFilterRadius] = useState(25)
  const [mapExpanded, setMapExpanded] = useState(false)

  const [live, setLive] = useState(null)
  const [geoState, setGeoState] = useState('idle')
  const [geoToken, setGeoToken] = useState(0)

  const [selected, setSelected] = useState(null)
  const [guidelines, setGuidelines] = useState([])
  const [ack, setAck] = useState(false)
  const [consentDs, setConsentDs] = useState(false)
  const [consentScr, setConsentScr] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  // Matches arrive from the matcher (F7) and stay live (FR-006).
  useEffect(() => {
    if (!user?.uid) return undefined
    return listenDonorMatches(user.uid, setMatches)
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    readProfile(user.uid)
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    listDonationTypes()
      .then(setDonationTypes)
      .catch(() => setDonationTypes([]))
  }, [])

  useEffect(() => {
    getSystemConfig()
      .then((cfg) => {
        if (!cfg || !Array.isArray(cfg.radiusTiers)) return
        const tiers = [...cfg.radiusTiers].sort((a, b) => (a.tierOrder ?? 0) - (b.tierOrder ?? 0))
        const kms = tiers.map((t) => Number(t.radiusKm)).filter((n) => Number.isFinite(n) && n > 0)
        if (!kms.length) return
        setRadiusTiers(kms)
        setFilterRadius(kms[kms.length - 1])
      })
      .catch(() => {})
  }, [])

  // Live position: kept in page state, never written to Firestore (D30).
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState('unsupported')
      return undefined
    }
    setGeoState('locating')
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setLive({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setGeoState('live')
      },
      (err) => {
        setGeoState(err?.code === 1 ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [geoToken])

  // Hydrate the request and hospital documents behind each match, once each.
  useEffect(() => {
    const requestIds = [...new Set(matches.map((m) => m.requestId).filter(Boolean))]
    requestIds.forEach((id) => {
      if (requestsById[id]) return
      getBloodRequest(id)
        .then((req) => {
          if (req) setRequestsById((prev) => ({ ...prev, [id]: req }))
        })
        .catch(() => {})
    })
  }, [matches, requestsById])

  useEffect(() => {
    const hospitalIds = [
      ...new Set(Object.values(requestsById).map((req) => req.hospitalId).filter(Boolean)),
    ]
    hospitalIds.forEach((id) => {
      if (hospitalsById[id]) return
      getHospital(id)
        .then((hospital) => {
          if (hospital) setHospitalsById((prev) => ({ ...prev, [id]: hospital }))
        })
        .catch(() => {})
    })
  }, [requestsById, hospitalsById])

  const typesById = useMemo(() => new Map(donationTypes.map((t) => [t.id, t])), [donationTypes])
  const donorBlood = text(profile?.bloodType)

  // Live GPS first, saved profile coordinates as the fallback.
  const position = useMemo(() => {
    if (live) return { lat: live.lat, lng: live.lng, source: 'live' }
    const lat = Number(profile?.latitude)
    const lng = Number(profile?.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng) && profile?.latitude != null) {
      return { lat, lng, source: 'profile' }
    }
    return null
  }, [live, profile])

  const items = useMemo(() => {
    return matches
      .map((match) => {
        const request = requestsById[match.requestId]
        if (!request) return null
        const hospital = hospitalsById[request.hospitalId] ?? null
        const distance = position
          ? distanceKm(position.lat, position.lng, request.latitude, request.longitude)
          : null
        const type = typesById.get(match.donationTypeId) || typesById.get(request.component) || null
        const compatible = donorBlood ? canDonateTo(donorBlood, request.bloodType) : true
        const eligibility = eligibilityFor(
          {
            dateOfBirth: profile?.dateOfBirth,
            lastDonationAt: profile?.lastDonationAt,
            intervalDays: type?.intervalDays || null,
          },
          new Date(),
        )
        return { match, request, hospital, distance, type, compatible, eligibility }
      })
      .filter(Boolean)
  }, [matches, requestsById, hospitalsById, typesById, donorBlood, position, profile])

  const visible = useMemo(() => {
    return items.filter((it) => {
      if (filterBlood === 'compatible' && !it.compatible) return false
      if (filterComponent !== 'all' && it.request.component !== filterComponent) return false
      if (it.distance !== null && it.distance > filterRadius) return false
      return true
    })
  }, [items, filterBlood, filterComponent, filterRadius])

  // One pin per facility: requests at the same hospital share coordinates.
  const hospitalPins = useMemo(() => {
    const byHospital = new Map()
    visible.forEach((it) => {
      const key = it.request.hospitalId || `${it.request.latitude},${it.request.longitude}`
      if (!byHospital.has(key)) {
        byHospital.set(key, {
          key,
          hospital: it.hospital,
          request: it.request,
          items: [],
          distance: it.distance,
        })
      }
      const pin = byHospital.get(key)
      pin.items.push(it)
      if (pin.distance === null && it.distance !== null) pin.distance = it.distance
    })
    return [...byHospital.values()]
  }, [visible])

  const recipientPins = useMemo(() => {
    const byRecipient = new Map()
    visible.forEach((it) => {
      const { recipientLatitude: lat, recipientLongitude: lng } = it.request
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const key = it.request.recipientId || `${lat},${lng}`
      if (!byRecipient.has(key)) {
        byRecipient.set(key, {
          key,
          lat,
          lng,
          city: it.request.recipientCity,
          requests: [],
        })
      }
      byRecipient.get(key).requests.push(it)
    })
    return [...byRecipient.values()]
  }, [visible])

  const components = useMemo(
    () => [...new Set(items.map((i) => i.request.component).filter(Boolean))],
    [items],
  )

  const openRespond = async (it) => {
    setSelected(it)
    setAck(false)
    setConsentDs(false)
    setConsentScr(false)
    setError('')
    setGuidelines([])
    const typeId = it.type?.id || it.match.donationTypeId || it.request.component
    if (!typeId) return
    try {
      setGuidelines(await listGuidelines(typeId))
    } catch {
      setGuidelines([])
    }
  }

  const closeRespond = () => {
    if (acting) return
    setSelected(null)
  }

  const answer = async (status) => {
    if (!selected || selected.match.responseStatus !== 'Pending') return
    if (!ack) {
      setError('Acknowledge the guidelines before answering.')
      return
    }
    if (status === 'Accepted' && (!consentDs || !consentScr)) {
      setError('Both consents are required to accept.')
      return
    }
    setActing(true)
    setError('')
    try {
      if (status === 'Accepted') {
        await createConsent({
          donorId: user.uid,
          matchId: selected.match.id,
          consentType: CONSENT_DATA_SHARING.type,
        })
        await createConsent({
          donorId: user.uid,
          matchId: selected.match.id,
          consentType: CONSENT_SCREENING.type,
        })
      }
      await respondToMatch(
        selected.match.id,
        status,
        status === 'Accepted' && live ? { latitude: live.lat, longitude: live.lng } : null,
      )
      setSelected(null)
    } catch {
      setError(`Could not ${status === 'Accepted' ? 'accept' : 'decline'} the request. Try again.`)
    } finally {
      setActing(false)
    }
  }

  const centerOnMe = () => {
    const map = mapRef.current
    if (map && position) map.setView([position.lat, position.lng], 13)
  }

  if (loading || roleLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!role) return <Navigate to="/" replace />

  const mapCenter = position ? [position.lat, position.lng] : [14.5995, 120.9842]
  const accepted = items.filter((it) => it.match.responseStatus === 'Accepted' && it.hospital)

  return (
    <div className="pub" data-theme={theme} style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <header className="pub-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            Dugo<span>+</span>
          </span>
        </Link>
        <nav aria-label="Sections">
          <Link to="/donor/profile">Profile</Link>
          <Link to="/donor/requests">Blood Requests</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>

      <main id="top" className="profile-main">
        <div className="pub-card" style={{ maxWidth: 1240, width: '100%', margin: '0 auto', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p className="pub-kicker">Blood requests</p>
              <h3 style={{ margin: '4px 0 0 0' }}>Compatible requests near you</h3>
              <p className="pub-muted">
                {position?.source === 'live'
                  ? 'Distances follow your live location.'
                  : position
                    ? 'Distances use the location saved on your profile.'
                    : 'Set your location in your profile, or allow location access, to see distances.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="pub-btn pub-btn-ghost" type="button" onClick={centerOnMe} disabled={!position}>
                Center on me
              </button>
              <button className="pub-btn pub-btn-ghost" type="button" onClick={() => setMapExpanded((v) => !v)}>
                {mapExpanded ? 'Collapse map' : 'Expand map'}
              </button>
            </div>
          </div>

          {geoState === 'denied' && (
            <p className="pub-msg" data-kind="info" role="status">
              Location access is blocked, so live distance is off.{' '}
              <button className="auth-forgot" type="button" onClick={() => setGeoToken((n) => n + 1)}>
                Try again
              </button>
            </p>
          )}
          {geoState === 'unavailable' && (
            <p className="pub-msg" data-kind="info" role="status">
              Your location could not be read. Distances fall back to your saved profile.
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="pub-fine">Blood type</span>
              <select value={filterBlood} onChange={(e) => setFilterBlood(e.target.value)}>
                <option value="compatible">Compatible only</option>
                <option value="all">All matched</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="pub-fine">Component</span>
              <select value={filterComponent} onChange={(e) => setFilterComponent(e.target.value)}>
                <option value="all">All</option>
                <option value="whole-blood">Whole Blood</option>
                <option value="platelets">Platelets</option>
                <option value="plasma">Plasma</option>
                <option value="double-red-cells">Double Red Cells</option>
                <option value="rbc">RBC</option>
                {components
                  .filter((c) => !['whole-blood', 'platelets', 'plasma', 'double-red-cells', 'rbc'].includes(c))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="pub-fine">Radius</span>
              <select value={filterRadius} onChange={(e) => setFilterRadius(Number(e.target.value))}>
                {radiusTiers.map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mapExpanded ? '1fr' : 'minmax(300px, 460px) 1fr',
              gap: 16,
              marginTop: 16,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              {visible.length === 0 && (
                <p className="pub-muted">
                  No compatible requests match your filters. You will be notified when one does.
                </p>
              )}
              {visible.map((it) => (
                <div key={it.match.id} className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{it.hospital?.name || it.request.hospitalName || 'Hospital'}</strong>
                      <div className="pub-fine">
                        {it.request.bloodType} • {it.type?.name || it.request.component}
                        {it.request.component && it.type?.name && it.request.component !== it.type.name
                          ? ` (${it.request.component})`
                          : ''}
                      </div>
                      {it.hospital?.address && <div className="pub-fine">{it.hospital.address}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="badge" data-status={it.request.status}>
                        {it.request.urgencyLevel || it.request.status}
                      </span>
                      <span className="badge">{it.match.responseStatus}</span>
                    </div>
                  </div>
                  <div className="pub-fine">
                    {it.distance !== null ? `${it.distance.toFixed(1)} km away` : 'Distance unknown'} •{' '}
                    {it.request.quantity} unit{it.request.quantity === 1 ? '' : 's'}
                  </div>
                  {it.request.recipientCity && (
                    <div className="pub-fine">Recipient area: {it.request.recipientCity}</div>
                  )}
                  <div className="pub-fine">
                    Eligibility: {it.eligibility.label} — {it.eligibility.detail}
                  </div>
                  {it.match.responseStatus === 'Pending' ? (
                    <button className="pub-btn" type="button" onClick={() => openRespond(it)}>
                      Respond
                    </button>
                  ) : (
                    <p className="pub-fine">Answered — response is final.</p>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                height: mapExpanded ? '72vh' : 560,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'sticky',
                top: 16,
              }}
            >
              <MapContainer ref={mapRef} center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />

                {live && (
                  <>
                    <Circle
                      center={[live.lat, live.lng]}
                      radius={Math.max(30, live.accuracy || 0)}
                      pathOptions={{ color: '#1f6feb', weight: 1, fillOpacity: 0.08 }}
                    />
                    <Marker position={[live.lat, live.lng]} icon={ME_ICON}>
                      <Popup>Your location</Popup>
                    </Marker>
                  </>
                )}

                {accepted.map((it) =>
                  position && it.hospital ? (
                    <Polyline
                      key={`route-${it.match.id}`}
                      positions={[
                        [position.lat, position.lng],
                        [it.hospital.latitude ?? it.request.latitude, it.hospital.longitude ?? it.request.longitude],
                      ]}
                      pathOptions={{ color: '#c0392b', weight: 3, dashArray: '6 8', opacity: 0.8 }}
                    />
                  ) : null,
                )}

                {hospitalPins.map((pin) => (
                  <Marker
                    key={pin.key}
                    position={[pin.request.latitude, pin.request.longitude]}
                    icon={HOSPITAL_ICON}
                  >
                    <Popup>
                      <div style={{ display: 'grid', gap: 6, minWidth: 200 }}>
                        <strong>{pin.hospital?.name || pin.request.hospitalName}</strong>
                        {pin.hospital?.address && <span>{pin.hospital.address}</span>}
                        {pin.hospital?.contactNumber && <span>{pin.hospital.contactNumber}</span>}
                        {pin.distance !== null && <span>{pin.distance.toFixed(1)} km away</span>}
                        <div style={{ borderTop: '1px solid #ddd', paddingTop: 6, display: 'grid', gap: 6 }}>
                          {pin.items.map((it) => (
                            <div key={it.match.id} style={{ display: 'grid', gap: 2 }}>
                              <span>
                                <strong>{it.request.bloodType}</strong> • {it.type?.name || it.request.component} •{' '}
                                {it.request.quantity} unit{it.request.quantity === 1 ? '' : 's'}
                              </span>
                              <span style={{ fontSize: 12 }}>
                                {it.request.urgencyLevel} • {it.match.responseStatus}
                              </span>
                              {it.match.responseStatus === 'Pending' ? (
                                <button className="pub-btn" type="button" onClick={() => openRespond(it)}>
                                  Respond
                                </button>
                              ) : (
                                <span style={{ fontSize: 12 }}>{it.match.responseStatus}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {recipientPins.map((pin) => (
                  <Marker key={`rec-${pin.key}`} position={[pin.lat, pin.lng]} icon={RECIPIENT_ICON}>
                    <Popup>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>Recipient</strong>
                        {pin.city && <span>{pin.city}</span>}
                        <span style={{ fontSize: 12 }}>
                          {pin.requests.map((it) => `${it.request.bloodType} ${it.request.component}`).join(', ')}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {accepted.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Directions to your accepted donations</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {accepted.map((it) => {
                  const to = [
                    it.hospital.latitude ?? it.request.latitude,
                    it.hospital.longitude ?? it.request.longitude,
                  ]
                  const url = position ? directionsUrl([position.lat, position.lng], to) : ''
                  return (
                    <div key={`dir-${it.match.id}`} className="card" style={{ padding: 12 }}>
                      <strong>{it.hospital.name || it.request.hospitalName}</strong>
                      <div className="pub-fine">{it.hospital.address}</div>
                      {url && (
                        <a className="pub-btn pub-btn-ghost" href={url} target="_blank" rel="noreferrer">
                          Open directions
                          <Icon name="arrow-right" size={14} />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="pub-card"
            style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Respond to request</h3>
              <button className="pub-btn pub-btn-ghost" type="button" onClick={closeRespond} disabled={acting}>
                Close
              </button>
            </div>
            <p className="pub-muted">
              {selected.hospital?.name || selected.request.hospitalName} • {selected.request.bloodType} •{' '}
              {selected.type?.name || selected.match.donationTypeId}
            </p>
            {selected.hospital?.address && <p className="pub-fine">{selected.hospital.address}</p>}
            <p className="pub-fine">
              Eligibility: {selected.eligibility.label} — {selected.eligibility.detail}
            </p>

            <div style={{ marginTop: 16 }}>
              <strong>Eligibility guidelines</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {guidelines.length === 0 && <p className="pub-fine">No guidelines published for this component.</p>}
                {guidelines.map((g) => (
                  <div key={g.id} className="card" style={{ padding: 12 }}>
                    <strong>{g.title}</strong>
                    <p className="pub-fine" style={{ margin: '4px 0 0 0' }}>
                      {g.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16 }}>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                disabled={acting || selected.match.responseStatus !== 'Pending'}
              />
              <span>I have read and acknowledge the eligibility guidelines.</span>
            </label>

            <div style={{ marginTop: 16 }}>
              <strong>Consent</strong>
              <p className="pub-fine">Both are required to accept. Declining needs neither.</p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={consentDs}
                  onChange={(e) => setConsentDs(e.target.checked)}
                  disabled={acting || selected.match.responseStatus !== 'Pending'}
                />
                <span>
                  <strong>{CONSENT_DATA_SHARING.title}</strong>
                  <span className="pub-fine" style={{ display: 'block' }}>
                    {CONSENT_DATA_SHARING.text}
                  </span>
                </span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={consentScr}
                  onChange={(e) => setConsentScr(e.target.checked)}
                  disabled={acting || selected.match.responseStatus !== 'Pending'}
                />
                <span>
                  <strong>{CONSENT_SCREENING.title}</strong>
                  <span className="pub-fine" style={{ display: 'block' }}>
                    {CONSENT_SCREENING.text}
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p className="pub-msg" data-kind="error" role="alert" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}

            {selected.match.responseStatus === 'Pending' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="pub-btn" type="button" onClick={() => answer('Accepted')} disabled={acting}>
                  {acting ? 'Sending…' : 'Accept'}
                </button>
                <button
                  className="pub-btn pub-btn-ghost"
                  type="button"
                  onClick={() => answer('Declined')}
                  disabled={acting}
                >
                  Decline
                </button>
              </div>
            ) : (
              <p className="pub-fine" style={{ marginTop: 16 }}>
                This match is {selected.match.responseStatus} and cannot be changed.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
