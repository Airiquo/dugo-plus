import test from 'node:test'
import assert from 'node:assert/strict'
import { geohash, geohashDecode, geohashNeighbors } from './geohash.js'

test('geohash encodes and decodes a known point', () => {
  const hash = geohash(14.5995, 120.9842, 7)
  assert.equal(hash.length, 7)
  const decoded = geohashDecode(hash)
  assert.ok(decoded)
  assert.ok(Math.abs(decoded.lat - 14.5995) < 0.001)
  assert.ok(Math.abs(decoded.lng - 120.9842) < 0.001)
})

test('geohashDecode rejects bad input', () => {
  assert.equal(geohashDecode(''), null)
  assert.equal(geohashDecode('!!!!'), null)
  assert.equal(geohashDecode(null), null)
})

test('geohashNeighbors returns the centre and eight adjacent cells', () => {
  const hash = geohash(14.5995, 120.9842, 5)
  const neighbours = geohashNeighbors(hash)
  assert.equal(neighbours.length, 9)
  assert.equal(new Set(neighbours).size, 9)
  assert.equal(neighbours[0], hash)
  for (const neighbour of neighbours) {
    assert.ok(geohashDecode(neighbour), `${neighbour} decodes`)
  }
})

test('geohashNeighbors handles the antimeridian without duplicates', () => {
  const hash = geohash(-16.5, 179.99, 4)
  const neighbours = geohashNeighbors(hash)
  assert.equal(neighbours.length, 9)
  assert.equal(new Set(neighbours).size, 9)
  for (const neighbour of neighbours) assert.ok(geohashDecode(neighbour))
})

test('geohashNeighbors returns no cells for invalid input', () => {
  assert.deepEqual(geohashNeighbors(''), [])
  assert.deepEqual(geohashNeighbors('!!!!'), [])
})
