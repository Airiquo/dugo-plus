/** A finite, in-range point, excluding missing values and the 0,0 placeholder. */
export function asPoint(lat, lng) {
  const usable = (value) =>
    (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
  if (!usable(lat) || !usable(lng)) return null
  const point = { lat: Number(lat), lng: Number(lng) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null
  if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null
  if (point.lat === 0 && point.lng === 0) return null
  return point
}

export function toRad(value) {
  return (value * Math.PI) / 180
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null
  }
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
