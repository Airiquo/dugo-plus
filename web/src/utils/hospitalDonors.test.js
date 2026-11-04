import test from 'node:test'
import assert from 'node:assert/strict'
import { filterHospitalDonors, donorDirectoryColumns } from './hospitalDonors.js'
import { collectExportPages, tableCsv, tablePrintHtml } from './tableExport.js'

test('complete traversal applies shared name/group filtering and sorting after all pages', async () => {
  const pages = { first: { rows: [{ id: 'a', donor: null }], nextCursor: 'b' }, b: { rows: [{ id: 'b', donor: { fullName: 'Ána', bloodType: 'O-' } }, { id: 'c', donor: { fullName: 'Ana Two', bloodType: 'A+' } }], nextCursor: null } }
  const rows = await collectExportPages(after => pages[after || 'first'], { cursorKey: 'nextCursor' })
  assert.deepEqual(filterHospitalDonors(rows, { search: 'ana', bloodType: 'O-' }, { key: 'donor', direction: 'asc' }).map(row => row.id), ['b'])
  assert.equal(filterHospitalDonors(rows, { bloodType: 'private' }, {}).length, 1)
})

test('history dates include complete Philippine days and preserve donor references in reports', () => {
  const rows = [{ id: 'a', donorId: 'd', component: 'plasma', bloodType: 'O-', donationDate: '2026-11-01T16:00:00Z' }, { id: 'b', donorId: 'd', component: 'plasma', bloodType: 'O-', donationDate: '2026-11-02T16:00:00Z' }]
  assert.deepEqual(filterHospitalDonors(rows, { from: '2026-11-02', to: '2026-11-02', component: 'plasma' }, {}, true).map(row => row.id), ['a'])
})

test('a rejected later page never yields partial CSV and private profiles cannot enter reports', async () => {
  await assert.rejects(collectExportPages(after => after ? Promise.reject(new Error('unavailable')) : { rows: [{ id: 'a' }], nextCursor: 'b' }, { cursorKey: 'nextCursor' }), /unavailable/)
  const rows = [{ id: 'a', donor: null }, { id: 'b', donor: { fullName: '=danger', email: '<script>bad</script>' } }]
  const csv = tableCsv(donorDirectoryColumns, rows)
  assert.ok(csv.includes("'=danger")); assert.ok(csv.includes('Private'))
  assert.ok(tablePrintHtml('Donors', 'Facility', donorDirectoryColumns, rows).includes('&lt;script&gt;'))
})
