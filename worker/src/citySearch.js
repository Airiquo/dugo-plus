import { HttpError } from './http.js'
const cache = new Map()
let previousAt = 0

/** Bounded Philippine city suggestions; only the query text reaches Photon. */
export async function searchCities(input, { endpoint = 'https://photon.komoot.io/api/', fetcher = fetch, now = Date.now, minimumGapMs = 400 } = {}) {
  const query = typeof input?.query === 'string' ? input.query.trim() : ''
  if (query.length < 3 || query.length > 120) throw new HttpError(400, 'Enter 3–120 characters for a city.')
  const key = endpoint + ':' + query.toLocaleLowerCase(), time = now()
  const found = cache.get(key)
  if (found && found.until > time) return found.result
  if (time - previousAt < minimumGapMs) throw new HttpError(429, 'Please wait a moment before looking up another city.')
  previousAt = time
  const url = new URL(endpoint)
  url.search = new URLSearchParams({ q: query, countrycode: 'PH', limit: '8', lang: 'en' })
  let response
  try { response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }) }
  catch { throw new HttpError(502, 'City lookup unavailable. Enter your city manually.') }
  if (!response.ok) throw new HttpError(502, 'City lookup unavailable. Enter your city manually.')
  const result = await response.json()
  const cities = [...new Set((result.features || []).map(feature => {
    const p = feature.properties || {}
    if (p.countrycode?.toUpperCase() !== 'PH') return ''
    const city = p.city || (p.osm_key === 'place' && ['city', 'town', 'municipality', 'village'].includes(p.osm_value) ? p.name : '')
    return typeof city === 'string' && city ? [city, p.state].filter(Boolean).join(', ') : ''
  }).filter(Boolean))].slice(0, 8)
  const payload = { cities, attribution: '© OpenStreetMap contributors · Photon' }
  cache.set(key, { result: payload, until: time + 86400000 })
  if (cache.size > 200) cache.delete(cache.keys().next().value)
  return payload
}
