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

/**
 * Decode a geohash into its bounding box and centre.
 *
 * @param {string} hash
 * @returns {{
 *   lat: number, lng: number,
 *   latMin: number, latMax: number, lngMin: number, lngMax: number,
 *   latErr: number, lngErr: number,
 * } | null} null when the input is empty or contains an unknown character
 */
export function geohashDecode(hash) {
  if (typeof hash !== 'string' || hash.length === 0) return null

  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let even = true

  for (const char of hash.toLowerCase()) {
    const index = BASE32.indexOf(char)
    if (index === -1) return null
    for (let mask = 16; mask > 0; mask >>= 1) {
      const bit = (index & mask) !== 0
      if (even) {
        const mid = (lngMin + lngMax) / 2
        if (bit) lngMin = mid
        else lngMax = mid
      } else {
        const mid = (latMin + latMax) / 2
        if (bit) latMin = mid
        else latMax = mid
      }
      even = !even
    }
  }

  const lat = (latMin + latMax) / 2
  const lng = (lngMin + lngMax) / 2
  return {
    lat,
    lng,
    latMin,
    latMax,
    lngMin,
    lngMax,
    latErr: (latMax - latMin) / 2,
    lngErr: (lngMax - lngMin) / 2,
  }
}

/** Wrap longitude into [-180, 180) and clamp latitude to [-90, 90]. */
function normalisePoint(lat, lng) {
  const safeLat = Math.max(-90, Math.min(90, lat))
  let safeLng = lng
  while (safeLng < -180) safeLng += 360
  while (safeLng >= 180) safeLng -= 360
  return { lat: safeLat, lng: safeLng }
}

/**
 * The geohash itself plus its eight neighbours.
 *
 * Used to turn one radius centre into the small set of prefix ranges a
 * Firestore query can scan. The centre is included first.
 *
 * @param {string} hash
 * @returns {string[]} unique geohashes at the same precision; [] for bad input
 */
export function geohashNeighbors(hash) {
  const decoded = geohashDecode(hash)
  if (!decoded) return []

  const precision = hash.length
  const width = decoded.lngErr * 2
  const height = decoded.latErr * 2
  const found = [hash]

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dy === 0 && dx === 0) continue
      const point = normalisePoint(decoded.lat + dy * height, decoded.lng + dx * width)
      const next = geohash(point.lat, point.lng, precision)
      if (next && !found.includes(next)) found.push(next)
    }
  }

  return found
}
