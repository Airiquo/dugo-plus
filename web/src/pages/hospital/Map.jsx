import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../hooks/useAuth'
import { readHospital, saveHospital } from '../../services/hospitals'
import { isCoordinate } from '../../utils/geohash'
import { HospitalShell } from '../../layout/HospitalShell'
import { Btn, Card, Modal, PageHeader } from '../../components'

const PH_CENTER = [12.8797, 121.774]
const PH_BOUNDS = L.latLngBounds([4.2, 116], [21.5, 127])

/** A coordinate pair is usable only inside the operating area. */
function inPhilippines(latitude, longitude) {
  return isCoordinate(latitude, longitude) && PH_BOUNDS.contains([latitude, longitude])
}

/** A saved coordinate pair is usable only inside the operating area. */
function hasLocation(hospital) {
  return Boolean(hospital) && inPhilippines(hospital.latitude, hospital.longitude)
}

/** A compact coordinate readout. */
function coordinate(value) {
  return Number.isFinite(value) ? value.toFixed(6) : '—'
}

/**
 * Hospital map — `/hospital/map` (FR-015).
 *
 * Shows the facility on OpenStreetMap and lets staff pick a replacement point
 * by clicking the map or using device geolocation. The saved point changes only
 * after the selection is confirmed in a dialog. The map is bounded to the
 * Philippines, the system's operating area.
 */
export default function Map() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const mapNode = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const candidateMarker = useRef(null)
  const userMarker = useRef(null)
  const [hospital, setHospital] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [candidate, setCandidate] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mapNode.current) return undefined
    const instance = L.map(mapNode.current, {
      center: PH_CENTER,
      zoom: 7,
      minZoom: 7,
      maxZoom: 19,
      maxBounds: PH_BOUNDS,
      maxBoundsViscosity: 1,
      noWrap: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      noWrap: true,
    }).addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      marker.current = null
      candidateMarker.current = null
      userMarker.current = null
    }
  }, [])

  useEffect(() => {
    if (!map.current) return
    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }
    if (!hasLocation(hospital)) {
      map.current.setView(PH_CENTER, 7)
      return
    }
    const point = [hospital.latitude, hospital.longitude]
    marker.current = L.marker(point, {
      icon: L.divIcon({
        className: 'hospital-map-pin',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      interactive: false,
      keyboard: false,
      title: hospital.name || 'Facility',
    }).addTo(map.current)
    map.current.setView(point, 15)
  }, [hospital])

  useEffect(() => {
    if (!map.current) return
    if (candidateMarker.current) {
      candidateMarker.current.remove()
      candidateMarker.current = null
    }
    if (!candidate) return
    candidateMarker.current = L.marker([candidate.latitude, candidate.longitude], {
      icon: L.divIcon({
        className: 'hospital-map-pin is-candidate',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
      title: 'Selected facility location',
    }).addTo(map.current)
  }, [candidate])

  useEffect(() => {
    if (!map.current) return
    if (userMarker.current) {
      userMarker.current.remove()
      userMarker.current = null
    }
    if (!userLocation) return
    userMarker.current = L.marker([userLocation.latitude, userLocation.longitude], {
      icon: L.divIcon({
        className: 'hospital-map-user-pin',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 500,
      title: 'Your current location',
    }).addTo(map.current)
  }, [userLocation])

  useEffect(() => {
    const instance = map.current
    if (!instance || !selecting) return undefined
    const onPick = (event) => {
      const latitude = Number(event.latlng.lat.toFixed(6))
      const longitude = Number(event.latlng.lng.toFixed(6))
      if (!inPhilippines(latitude, longitude)) {
        setError('Choose a point inside the Philippines.')
        return
      }
      setCandidate({ latitude, longitude })
      setError('')
      setNote('')
    }
    instance.on('click', onPick)
    return () => instance.off('click', onPick)
  }, [selecting])

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false)
      return undefined
    }
    let current = true
    setLoading(true)
    setLoadFailed(false)
    readHospital(hospitalId)
      .then((found) => {
        if (current) setHospital(found)
      })
      .catch(() => {
        if (current) setLoadFailed(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [hospitalId])

  const startRelocate = () => {
    setSelecting(true)
    setCandidate(null)
    setConfirmOpen(false)
    setSaveError('')
    setNote('')
    setError('')
    if (!map.current) return
    if (hasLocation(hospital)) {
      map.current.setView([hospital.latitude, hospital.longitude], 15)
    } else {
      map.current.setView(PH_CENTER, 7)
    }
  }

  const cancelSelection = () => {
    setSelecting(false)
    setCandidate(null)
    setConfirmOpen(false)
    setSaveError('')
    setError('')
    setNote('')
  }

  const requestLocation = (onFound) => {
    if (locating) return
    setError('')
    setNote('')
    setSaveError('')
    if (!navigator.geolocation) {
      setError('This browser cannot read your location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6))
        const longitude = Number(position.coords.longitude.toFixed(6))
        setLocating(false)
        if (!inPhilippines(latitude, longitude)) {
          setError('Your current location is outside the Philippines.')
          return
        }
        onFound(latitude, longitude)
      },
      (reason) => {
        setLocating(false)
        setError(
          reason.code === reason.PERMISSION_DENIED
            ? 'Location permission was denied. Allow it in the browser and try again.'
            : reason.code === reason.TIMEOUT
              ? 'Finding your location timed out. Try again.'
              : 'Your location could not be read. Try again.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const locateUser = () => {
    requestLocation((latitude, longitude) => {
      setUserLocation({ latitude, longitude })
      setNote('Showing your current location.')
      map.current?.setView([latitude, longitude], 16)
    })
  }

  const useCurrentLocation = () => {
    requestLocation((latitude, longitude) => {
      setCandidate({ latitude, longitude })
      map.current?.setView([latitude, longitude], 16)
    })
  }

  const saveCandidate = async () => {
    if (!candidate || !hospitalId || saving) return
    const { latitude, longitude } = candidate
    if (!inPhilippines(latitude, longitude)) {
      setSaveError('Choose a point inside the Philippines.')
      return
    }
    setSaving(true)
    setSaveError('')
    setError('')
    try {
      await saveHospital(hospitalId, { latitude, longitude })
      setHospital((prev) => (prev ? { ...prev, latitude, longitude } : prev))
      setSelecting(false)
      setCandidate(null)
      setConfirmOpen(false)
      setNote('Facility location updated.')
    } catch {
      setSaveError('The facility location could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const canRelocate = Boolean(hospitalId && hospital && !loadFailed)

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader tag="Dugo+ hospital" title="Hospital Map" />
      <div id="page-body">
        <div className="hospital-map-page">
          <Card aria-busy={saving}>
            <header className="hospital-map-head">
              <div>
                <h2>{hospital?.name || 'Facility location'}</h2>
                <p className="muted">{hospital?.address || 'No address saved.'}</p>
              </div>
              {selecting ? (
                <Btn onClick={cancelSelection} disabled={saving || locating}>
                  Cancel
                </Btn>
              ) : (
                <Btn
                  variant="primary"
                  icon="target"
                  onClick={startRelocate}
                  disabled={!canRelocate || saving}
                >
                  Relocate
                </Btn>
              )}
            </header>

            {loading && <p className="hospital-state">Loading facility…</p>}

            {!loading && !hospitalId && (
              <p className="hospital-state" data-kind="warn" role="status">
                This account is not linked to a facility yet. Ask an administrator to set your
                hospital, then reload.
              </p>
            )}

            {!loading && hospitalId && loadFailed && (
              <p className="hospital-state" data-kind="error" role="alert">
                Your facility could not be loaded. Check your connection and reload the page.
              </p>
            )}

            {!loading && hospitalId && !loadFailed && !hospital && (
              <p className="hospital-state" data-kind="warn" role="status">
                No facility record was found for this account. Ask an administrator to check the
                link.
              </p>
            )}

            {!loading && hospital && !hasLocation(hospital) && !selecting && (
              <p className="hospital-state" data-kind="warn" role="status">
                No Philippines location is saved yet. Use Relocate to set the facility point.
              </p>
            )}

            {selecting && (
              <div className="hospital-map-prompt">
                <div className="hospital-map-prompt-copy" aria-live="polite">
                  <strong>{candidate ? 'Location selected' : 'Choose the facility location'}</strong>
                  <p>
                    {candidate
                      ? 'Confirm this point, or click the map to choose another.'
                      : 'Click anywhere on the map to place the pin, or use your current location.'}
                  </p>
                  {candidate && (
                    <p className="hospital-map-coords">
                      {coordinate(candidate.latitude)}, {coordinate(candidate.longitude)}
                    </p>
                  )}
                </div>
                <div className="hospital-map-prompt-actions">
                  <Btn
                    icon="target"
                    onClick={useCurrentLocation}
                    disabled={locating || saving}
                  >
                    {locating ? 'Locating…' : 'Use current location'}
                  </Btn>
                  <Btn
                    variant="primary"
                    icon="check"
                    onClick={() => {
                      setSaveError('')
                      setConfirmOpen(true)
                    }}
                    disabled={!candidate || saving}
                  >
                    Confirm location
                  </Btn>
                </div>
              </div>
            )}

            <div className="hospital-map-wrap">
              <div
                ref={mapNode}
                className={selecting ? 'hospital-map-canvas is-selecting' : 'hospital-map-canvas'}
                role="region"
                aria-label="Facility map"
              />
              <Btn
                variant="primary"
                icon="target"
                className="hospital-map-locate"
                onClick={locateUser}
                disabled={locating || saving}
                aria-label={locating ? 'Finding your location' : 'Go to my current location'}
                aria-busy={locating || undefined}
                title={locating ? 'Finding your location' : 'Go to my current location'}
              />
            </div>

            <dl className="hospital-facts hospital-map-facts">
              <div>
                <dt>Latitude</dt>
                <dd>{hasLocation(hospital) ? coordinate(hospital.latitude) : '—'}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd>{hasLocation(hospital) ? coordinate(hospital.longitude) : '—'}</dd>
              </div>
            </dl>

            {error && (
              <p className="hospital-state" data-kind="error" role="alert">
                {error}
              </p>
            )}
            {note && (
              <p className="hospital-state" role="status">
                {note}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        name="hospital-relocate"
        open={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false)
        }}
        title="Confirm facility location"
      >
        {candidate && (
          <>
            <p className="hospital-note">
              Use this point as the facility’s saved location? This replaces the current pin used
              for nearby donor matching.
            </p>
            <dl className="hospital-facts hospital-map-confirm-facts">
              <div>
                <dt>Latitude</dt>
                <dd>{coordinate(candidate.latitude)}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd>{coordinate(candidate.longitude)}</dd>
              </div>
            </dl>
          </>
        )}
        {saveError && (
          <p className="hospital-state" data-kind="error" role="alert">
            {saveError}
          </p>
        )}
        <div className="hospital-dialog-actions">
          <Btn variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
            Back
          </Btn>
          <Btn
            variant="primary"
            icon="check"
            onClick={saveCandidate}
            disabled={saving || !candidate}
          >
            {saving ? 'Saving…' : 'Save location'}
          </Btn>
        </div>
      </Modal>
    </HospitalShell>
  )
}
