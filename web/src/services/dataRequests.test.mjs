/** Run with node --experimental-vm-modules --test web/src/services/dataRequests.test.mjs. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { REJECTION_REASONS } from '../utils/dataRequestReview.js'

async function service({ pages = [], failPage = -1 } = {}) {
  const writes = [], reads = [], audits = []
  const timestamp = Symbol('server timestamp')
  const firebase = {
    collection: (_db, path) => ({ path }), doc: (_db, path, id) => ({ path, id }),
    documentId: () => '__name__', orderBy: field => ({ orderBy: field }),
    limit: size => ({ limit: size }), startAfter: cursor => ({ cursor }),
    where: (...scope) => ({ where: scope }), query: (ref, ...constraints) => ({ ref, constraints }),
    serverTimestamp: () => timestamp,
    addDoc: async (ref, data) => { writes.push({ ref, data }); return { id: 'new' } },
    updateDoc: async (ref, data) => { writes.push({ ref, data }) },
    getDocs: async query => {
      reads.push(query)
      if (reads.length - 1 === failPage) throw Error('read interrupted')
      const docs = pages[reads.length - 1] || []
      return { docs, size: docs.length }
    },
  }
  const source = new SourceTextModule(await readFile(new URL('./dataRequests.js', import.meta.url), 'utf8'))
  await source.link(specifier => {
    const exports = specifier === 'firebase/firestore' ? firebase
      : specifier === '../lib/firebase' ? { db: {} }
      : specifier === '../utils/dataRequestReview' ? { REJECTION_REASONS }
      : { recordAuditEvent: async event => { audits.push(event) } }
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    })
  })
  await source.evaluate()
  return { api: source.namespace, writes, reads, audits, timestamp }
}

test('service accepts every supported type and trims Other details before creating', async () => {
  const { api, writes, timestamp } = await service()
  for (const type of ['Access', 'Rectification', 'Erasure', 'Export', 'Other'])
    assert.equal(await api.createDataRequest('alice', type, '  Written details\nwith context.  '), 'new')
  assert.equal(writes.length, 5)
  assert.equal(writes[4].data.details, 'Written details\nwith context.')
  assert.equal(writes[4].data.requestType, 'Other')
  assert.equal(writes[4].data.status, 'Pending')
  assert.equal(writes[4].data.createdAt, timestamp)
  for (const details of ['', ' \n\t ', null, {}, 'x'.repeat(2001)])
    await assert.rejects(api.createDataRequest('alice', 'Other', details))
  await assert.rejects(api.createDataRequest('alice', 'Unknown', 'detail'))
  await assert.rejects(api.createDataRequest('', 'Other', 'detail'))
  assert.equal(writes.length, 5)
})

test('service rejects missing or invalid reasons and explanations without writing', async () => {
  const { api, writes, audits, timestamp } = await service()
  const rejection = { status: 'Rejected', processedBy: 'admin', adminNote: 'Written explanation.', rejectionReason: 'Other' }
  for (const changes of [
    { rejectionReason: '' }, { rejectionReason: 'Invalid' }, { adminNote: '' },
    { adminNote: ' \n\t ' }, { adminNote: {} }, { adminNote: 'x'.repeat(2001) }, { processedBy: '' },
  ]) await assert.rejects(api.updateDataRequest('request', { ...rejection, ...changes }))
  assert.equal(writes.length, 0)
  for (const reason of REJECTION_REASONS)
    await api.updateDataRequest('request', { ...rejection, rejectionReason: reason.value })
  assert.equal(writes.length, REJECTION_REASONS.length)
  assert.equal(writes.at(-1).data.status, 'Rejected')
  assert.equal(writes.at(-1).data.rejectionReason, 'Other')
  assert.equal(writes.at(-1).data.resolvedAt, timestamp)
  assert.ok(audits.every(event => event.eventType === 'DataAccess.Rejected'))
})

test('completion retains export/correction/erasure actions and supports written Other responses', async () => {
  const { api, writes, audits } = await service()
  for (const action of ['Export', 'Correction', 'Deletion', 'Response']) {
    await api.updateDataRequest('request', { status: 'Completed', processedBy: 'admin', adminNote: '  Response delivered. ', resolutionAction: action })
    assert.equal(writes.at(-1).data.resolutionAction, action)
    assert.equal(writes.at(-1).data.adminNote, 'Response delivered.')
    assert.equal(audits.at(-1).eventType, `DataAccess.${action}`)
  }
  await assert.rejects(api.updateDataRequest('request', { status: 'Completed', processedBy: 'admin', adminNote: 'Done' }))
  await assert.rejects(api.updateDataRequest('request', { status: 'Completed', processedBy: 'admin', adminNote: ' ', resolutionAction: 'Response' }))
  assert.equal(writes.length, 4)
})

const record = (id, status = 'Rejected') => ({ id, data: () => ({ userId: 'alice', requestType: 'Other', status, details: `Details ${id}`, adminNote: `Response ${id}`, createdAt: { toDate: () => new Date(2026, 0, Number(id)) } }) })
test('history reads all bounded pages with owner scope and retains legacy rejected responses', async () => {
  const page = Array.from({ length: 100 }, (_, i) => record(String(i + 1)))
  const { api, reads } = await service({ pages: [page, [record('101', 'Completed')]] })
  const rows = await api.listMyDataRequests('alice')
  assert.equal(rows.length, 101)
  assert.equal(rows[0].id, '101')
  assert.equal(rows.filter(row => row.status === 'Rejected').length, 100)
  assert.equal(rows.at(-1).adminNote, 'Response 1')
  assert.equal(rows.at(-1).rejectionReason, '')
  assert.equal(reads.length, 2)
  for (const read of reads) {
    assert.ok(read.constraints.some(part => part.limit === 100))
    assert.deepEqual(read.constraints.find(part => part.where).where, ['userId', '==', 'alice'])
    assert.ok(read.constraints.some(part => part.orderBy === '__name__'))
  }
  assert.equal(reads[1].constraints.find(part => part.cursor).cursor, page.at(-1))
  await assert.rejects(api.listMyDataRequests(''))
  assert.equal(reads.length, 2)
})

test('a later-page read failure returns no partial export/history result', async () => {
  const page = Array.from({ length: 100 }, (_, i) => record(String(i + 1)))
  const { api, reads } = await service({ pages: [page], failPage: 1 })
  await assert.rejects(api.listAllDataRequests(), /read interrupted/)
  assert.equal(reads.length, 2)
  assert.ok(reads.every(read => !read.constraints.some(part => part.where)))
})
