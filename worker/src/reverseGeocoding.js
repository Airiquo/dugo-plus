const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const REQUEST_GAP_MS = 1000
const memoryCache = new Map()
let lastNetworkRequestAt = 0

const localities = [
  'city',
  'municipality',
  'town',
  'village',
  'suburb',
  'city_district',
  'hamlet',
]

function validPoint(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  )
}

function cityFromResult(result) {
  const address = result?.address || {}
  for (const key of localities) {
    const value = address[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function coarseCoordinate(value) {
  return Number(value.toFixed(3))
}

/** Reverse geocodes a user-requested GPS point to a city-level label. */
export async function reverseGeocodeCity(
  input,
  {
    endpoint = DEFAULT_ENDPOINT,
    fetcher = fetch,
    now = Date.now,
    cache = memoryCache,
    minimumGapMs = REQUEST_GAP_MS,
  } = {},
) {
  const latitude = Number(input?.latitude),
    longitude = Number(input?.longitude)
  if (!validPoint(latitude, longitude)) {
    throw Object.assign(new Error('Location coordinates are invalid.'), {
      status: 400,
    })
  }

  const lat = coarseCoordinate(latitude),
    lon = coarseCoordinate(longitude),
    key = `${endpoint}:${lat}:${lon}`,
    time = now(),
    cached = cache.get(key)
  if (cached && cached.expiresAt > time) return cached.result

  if (time - lastNetworkRequestAt < minimumGapMs) {
    throw Object.assign(
      new Error('Please wait a moment before looking up your city again.'),
      { status: 429 },
    )
  }
  lastNetworkRequestAt = time

  const url = new URL(endpoint)
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(lat),
    lon: String(lon),
    zoom: '10',
    addressdetails: '1',
    layer: 'address',
  }).toString()

  let response
  try {
    response = await fetcher(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Dugo+ Donor Profile (https://dugo-plus.web.app)',
      },
      signal: AbortSignal.timeout(6000),
    })
  } catch {
    throw Object.assign(
      new Error('City lookup is unavailable. Enter your city manually.'),
      { status: 502 },
    )
  }
  if (!response.ok) {
    throw Object.assign(
      new Error('City lookup is unavailable. Enter your city manually.'),
      { status: 502 },
    )
  }

  const city = cityFromResult(await response.json())
  if (!city) {
    throw Object.assign(
      new Error('No city was found for this location. Enter it manually.'),
      { status: 404 },
    )
  }
  const result = { city, attribution: '© OpenStreetMap contributors' }
  cache.set(key, { result, expiresAt: time + CACHE_TTL_MS })
  return result
}

export function resetReverseGeocoderForTests() {
  memoryCache.clear()
  lastNetworkRequestAt = 0
}
