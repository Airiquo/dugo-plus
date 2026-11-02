import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cx } from '../utils/cx'
import { asPoint } from '../utils/geo'
import { Btn } from './Btn'

const pin = L.divIcon({ className: 'donation-map-hospital', html: '<span>+</span>',
  iconSize: [32, 36], iconAnchor: [16, 34] })
const coordinate = (point) => ({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) })

function LocationEvents({ position, editable, onChange }) {
  const map = useMap()
  useMapEvents({
    click(event) { if (editable) onChange(coordinate(event.latlng)) },
    keydown(event) {
      if (editable && event.originalEvent.key === 'Enter' && event.originalEvent.target === map.getContainer()) {
        event.originalEvent.preventDefault()
        onChange(coordinate(map.getCenter()))
      }
    },
  })
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), 14))
  }, [map, position?.lat, position?.lng])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

/** `editable` enables click/drag/keyboard pinning; `position` is {lat,lng} or null. */
export function HospitalLocationMap({ position, editable = false, disabled = false,
  onChange = () => {}, label = 'Facility location map', className, ...rest }) {
  const map = useRef(null)
  const [tileError, setTileError] = useState(false)
  const point = asPoint(position?.lat, position?.lng)
  const canEdit = editable && !disabled
  return <section className={cx('hospital-location-map', className)} aria-label={label} {...rest}>
    <MapContainer ref={map} center={point ? [point.lat, point.lng] : [12.8797, 121.7740]}
      zoom={point ? 14 : 6} scrollWheelZoom={false} className="hospital-location-canvas">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }} />
      <LocationEvents position={point} editable={canEdit} onChange={onChange} />
      {point && <Marker position={[point.lat, point.lng]} icon={pin} draggable={canEdit}
        title={editable ? 'Facility pin — drag to adjust' : 'Saved facility location'}
        eventHandlers={{ dragend: (event) => { if (canEdit) onChange(coordinate(event.target.getLatLng())) } }} />}
    </MapContainer>
    <div className="hospital-location-caption">
      <p>{editable ? 'Click the map or drag the pin. You can also pan with arrow keys and press Enter to place it.'
        : 'Saved facility location · Managed by your Dugo+ administrator'}</p>
      {editable && <Btn disabled={disabled} onClick={() => {
        if (map.current) onChange(coordinate(map.current.getCenter()))
      }}>Pin map centre</Btn>}
    </div>
    {tileError && <p className="hospital-map-error" role="status">Map tiles could not be loaded. {editable
      ? 'You can still enter coordinates below.' : 'The saved coordinates are shown below.'}</p>}
  </section>
}
