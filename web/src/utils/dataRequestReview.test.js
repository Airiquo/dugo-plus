import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesRequestStatus } from './dataRequestReview.js'

test('closed includes rejected history without changing the recorded outcome', () => {
  const rows = ['Pending', 'InProgress', 'Completed', 'Rejected'].map(status => ({ status }))
  assert.deepEqual(rows.filter(row => matchesRequestStatus(row.status, 'closed')).map(row => row.status), ['Completed', 'Rejected'])
  assert.deepEqual(rows.filter(row => matchesRequestStatus(row.status, 'Rejected')), [{ status: 'Rejected' }])
  assert.deepEqual(rows.filter(row => matchesRequestStatus(row.status, 'Completed')), [{ status: 'Completed' }])
  assert.deepEqual(rows.filter(row => matchesRequestStatus(row.status, 'open')).map(row => row.status), ['Pending', 'InProgress'])
  assert.equal(rows.filter(row => matchesRequestStatus(row.status, 'all')).length, 4)
})
