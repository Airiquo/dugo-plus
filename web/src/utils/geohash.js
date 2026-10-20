/**
 * Geohash encoding for stored donor locations (D4).
 *
 * A geohash packs a coordinate pair into a short string whose shared prefix
 * length means geographic closeness, so a radius query can read a small set of
 * neighbouring prefixes instead of scanning every donor. Encoding only: the
 * radius matcher that consumes it is NFR-05, built later.
 *
 * Standard base-32 alphabet. Precision 9 is the conventional street-level
 * length (~5 m); precision 7 (~150 m) is plenty for a donor radius and keeps
 * the field shorter.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/** Latitude/longitude bounds must be finite and in range. */
export function isCoordinate(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  )
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} [precision] characters to emit
 * @returns {string} the geohash, or '' when the coordinates are not usable
 */
export function geohash(lat, lng, precision = 7) {
  if (!isCoordinate(lat, lng)) return ''
  const chars = Math.max(1, Math.min(12, Math.floor(precision)))

  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let hash = ''
  let bits = 0
  let bit = 0
  let even = true

  while (hash.length < chars) {
    if (even) {
      const mid = (lngMin + lngMax) / 2
      if (lng > mid) {
        bit = (bit << 1) | 1
        lngMin = mid
      } else {
        bit <<= 1
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat > mid) {
        bit = (bit << 1) | 1
        latMin = mid
      } else {
        bit <<= 1
        latMax = mid
      }
    }
    even = !even
    if (++bits === 5) {
      hash += BASE32[bit]
      bits = 0
      bit = 0
    }
  }

  return hash
}
