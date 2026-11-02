import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { resetReverseGeocoderForTests, reverseGeocodeCity } from './reverseGeocoding.js'

beforeEach(() => resetReverseGeocoderForTests())

test('looks up a city from rounded coordinates and identifies the app', async () => {
  let requestedUrl, requestedOptions
  const result = await reverseGeocodeCity(
    { latitude: 14.59953, longitude: 120.98412 },
    {
      endpoint: 'https://geo.example/reverse',
      now: () => 5000,
      cache: new Map(),
      fetcher: async (url, options) => {
        requestedUrl = new URL(url)
        requestedOptions = options
        return Response.json({ address: { city: 'Manila' } })
      },
    },
  )

  assert.deepEqual(result, {
    city: 'Manila',
    attribution: '© OpenStreetMap contributors',
  })
  assert.equal(requestedUrl.searchParams.get('lat'), '14.6')
  assert.equal(requestedUrl.searchParams.get('lon'), '120.984')
  assert.equal(requestedUrl.searchParams.get('zoom'), '10')
  assert.equal(requestedUrl.searchParams.get('addressdetails'), '1')
  assert.match(requestedOptions.headers['User-Agent'], /Dugo\+/)
  assert.equal('Authorization' in requestedOptions.headers, false)
})

test('caches repeated city lookups for the same approximate point', async () => {
  const cache = new Map()
  let requests = 0
  const options = {
    endpoint: 'https://geo.example/reverse',
    now: () => 5000,
    cache,
    fetcher: async () => {
      requests += 1
      return Response.json({ address: { municipality: 'Quezon City' } })
    },
  }

  const first = await reverseGeocodeCity(
    { latitude: 14.59953, longitude: 120.98412 },
    options,
  )
  const second = await reverseGeocodeCity(
    { latitude: 14.59951, longitude: 120.9841 },
    options,
  )

  assert.equal(first.city, 'Quezon City')
  assert.deepEqual(second, first)
  assert.equal(requests, 1)
})

test('rejects invalid coordinates before calling the geocoder', async () => {
  let requested = false
  await assert.rejects(
    reverseGeocodeCity(
      { latitude: 91, longitude: 120 },
      { fetcher: async () => (requested = true) },
    ),
    /coordinates are invalid/i,
  )
  assert.equal(requested, false)
})

test('reports when the provider cannot determine a city', async () => {
  await assert.rejects(
    reverseGeocodeCity(
      { latitude: 14.6, longitude: 120.98 },
      {
        now: () => 5000,
        cache: new Map(),
        fetcher: async () => Response.json({ address: { road: 'Rizal Ave' } }),
      },
    ),
    /No city was found/i,
  )
})
