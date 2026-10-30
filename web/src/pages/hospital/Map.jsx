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

/** A saved coordinate pair is usable only inside the operating area. */
function hasLocation(hospital) {
  if (!hospital) return false
  const { latitude, longitude } = hospital
  return isCoordinate(latitude, longitude) && PH_BOUNDS.contains([latitude, longitude])
}

/** A compact coordinate readout. */
function coordinate(value) {
  return Number.isFinite(value) ? value.toFixed(6) : '—'
}

/**
 * Hospital map — `/hospital/map` (FR-015).
 *
 * Shows the facility on OpenStreetMap and lets staff replace the saved point
 * with the current device location. The map is bounded to the Philippines,
 * the system's operating area.
 */
export default function Map() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const mapNode = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const [hospital, setHospital] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mapNode.current) return undefined
    const instance = L.map(mapNode.current, {
      center: PH_CENTER,
      zoom: 6,
      minZoom: 6,
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
    }
  }, [])

  useEffect(() => {
    if (!map.current) return
    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }
    if (!hasLocation(hospital)) {
      map.current.setView(PH_CENTER, 6)
      return
    }
    const point = [hospital.latitude, hospital.longitude]
    marker.current = L.marker(point, {
      icon: L.divIcon({
        className: 'hospital-map-pin',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      keyboard: false,
      title: hospital.name || 'Facility',
    }).addTo(map.current)
    map.current.setView(point, 15)
  }, [hospital])

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

  const relocate = () => {
    setConfirmOpen(false)
    setNote('')
    setError('')
    if (!navigator.geolocation) {
      setError('This browser cannot read your location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6))
        const longitude = Number(position.coords.longitude.toFixed(6))
        if (!isCoordinate(latitude, longitude) || !PH_BOUNDS.contains([latitude, longitude])) {
          setLocating(false)
          setError('That location is outside the Philippines, so it cannot be saved.')
          return
        }
        setBusy(true)
        try {
          await saveHospital(hospitalId, { latitude, longitude })
          setHospital((prev) => (prev ? { ...prev, latitude, longitude } : prev))
          setNote('Facility location updated.')
        } catch {
          setError('The facility location could not be saved. Check your connection and try again.')
        } finally {
          setBusy(false)
          setLocating(false)
        }
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

  const canRelocate = Boolean(hospitalId && hospital && !loadFailed)

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader tag="Dugo+ hospital" title="Hospital Map" />
      <div id="page-body">
        <div className="hospital-map-page">
          <Card>
            <header className="hospital-map-head">
              <div>
                <h2>{hospital?.name || 'Facility location'}</h2>
                <p className="muted">{hospital?.address || 'No address saved.'}</p>
              </div>
              <Btn
                variant="primary"
                icon="target"
                onClick={() => setConfirmOpen(true)}
                disabled={!canRelocate || locating || busy}
              >
                {locating ? 'Locating…' : 'Relocate'}
              </Btn>
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

            {!loading && hospital && !hasLocation(hospital) && (
              <p className="hospital-state" data-kind="warn" role="status">
                No Philippines location is saved yet. Use Relocate to set the facility point.
              </p>
            )}

            <div
              ref={mapNode}
              className="hospital-map-canvas"
              role="region"
              aria-label="Facility map"
            />

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
        onClose={() => setConfirmOpen(false)}
        title="Relocate facility?"
      >
        <p className="hospital-note">
          Use this device’s current location as the facility’s saved map position? This replaces
          the hospital’s coordinates.
        </p>
        <div className="hospital-dialog-actions">
          <Btn variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Btn>
          <Btn variant="primary" icon="target" onClick={relocate}>
            Use my location
          </Btn>
        </div>
      </Modal>
    </HospitalShell>
  )
}
