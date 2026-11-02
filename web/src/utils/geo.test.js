import test from 'node:test'
import assert from 'node:assert/strict'
import { asPoint } from './geo.js'

test('map points reject missing, partial, placeholder and out-of-range coordinates', () => {
  for (const [lat, lng] of [[null, 120], [14, null], ['', 120], [' ', 120],
    [undefined, 120], [false, 120], [0, 0], [NaN, 120], [Infinity, 120],
    [91, 120], [14, 181]]) {
    assert.equal(asPoint(lat, lng), null)
  }
})

test('map points retain numeric coordinates including a valid zero axis', () => {
  assert.deepEqual(asPoint('14.6', '120.98'), { lat: 14.6, lng: 120.98 })
  assert.deepEqual(asPoint(0, 120), { lat: 0, lng: 120 })
  assert.deepEqual(asPoint(14, 0), { lat: 14, lng: 0 })
})
