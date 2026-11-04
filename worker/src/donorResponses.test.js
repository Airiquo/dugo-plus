import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDonorResponder,
  createDonorAlertReader,
} from './donorResponses.js'
const input = (id) => ({
  matchId: id,
  responseStatus: 'Accepted',
  acknowledged: true,
  dataSharingConsent: true,
  screeningConsent: true,
  location: { latitude: 14.8, longitude: 120.8 },
})
function fixture() {
  const rows = new Map([
    [
      'users/alice',
      {
        role: 'donor',
        status: 'Active',
        fullName: 'Alice Donor',
        city: 'Malolos',
        bloodType: 'O+',
        dateOfBirth: new Date('1990-01-01'),
      },
    ],
    ['hospitals/hospital', { status: 'Active' }],
    ['donationTypes/whole-blood', { intervalDays: 56 }],
    ...['one', 'two'].flatMap((id) => [
      [
        `bloodRequests/${id}`,
        {
          hospitalId: 'hospital',
          status: 'collecting',
          component: 'whole-blood',
          bloodType: 'O+',
        },
      ],
      [
        `donorMatches/${id}`,
        {
          requestId: id,
          donorId: 'alice',
          donationTypeId: 'whole-blood',
          responseStatus: 'Pending',
        },
      ],
    ]),
  ])
  let queue = Promise.resolve()
  const store = {
    transact(work) {
      const operation = queue.then(async () => {
        const changes = []
        const tx = {
          async get(collection, id) {
            const data = rows.get(`${collection}/${id}`)
            return data ? { id, data } : null
          },
          async query(query) {
            const collection = query.from[0].collectionId
            const filters = query.where.compositeFilter.filters
            return [...rows]
              .filter(
                ([path, data]) =>
                  path.startsWith(collection + '/') &&
                  filters.every(
                    (filter) =>
                      data[filter.fieldFilter.field.fieldPath] ===
                      filter.fieldFilter.value.stringValue,
                  ),
              )
              .map(([path, data]) => ({ id: path.split('/')[1], data }))
          },
          delete(path) { changes.push([path, undefined]) },
          create(path, data) {
            if (rows.has(path)) throw new Error('Already exists')
            changes.push([path, data])
          },
          update(path, data) {
            if (!rows.has(path)) throw new Error('Missing document')
            changes.push([path, { ...rows.get(path), ...data }])
          },
        }
        const result = await work(tx)
        for (const [path, data] of changes) { if (data === undefined) rows.delete(path); else rows.set(path, data) }
        return result
      })
      queue = operation.catch(() => {})
      return operation
    },
  }
  return {
    rows,
    store,
    respond: createDonorResponder(store, () => new Date('2026-11-02')),
    read: createDonorAlertReader(store),
  }
}

test('acceptance requires a complete donor profile', async () => {
  const { rows, respond } = fixture()
  const profile = rows.get('users/alice')
  profile.city = ''

  await assert.rejects(respond('alice', input('one')), (error) => {
    assert.equal(error.status, 409)
    assert.match(error.message, /complete your donor profile/i)
    assert.match(error.message, /city/i)
    return true
  })
  assert.equal(rows.get('donorMatches/one').responseStatus, 'Pending')
})
test('two simultaneous acceptances leave exactly one commitment and two consents', async () => {
  const { rows, respond } = fixture()
  const results = await Promise.allSettled([
    respond('alice', input('one')),
    respond('alice', input('two')),
  ])
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1)
  assert.equal(
    [...rows.keys()].filter((key) => key.startsWith('donorConsents/')).length,
    2,
  )
  assert.equal(rows.get('donorCommitments/alice').matchId, 'one')
  assert.equal(rows.get('donorMatches/two').responseStatus, 'Pending')
})
test('legacy accepted requests block another acceptance without an existing lock', async () => {
  const { rows, respond } = fixture()
  rows.get('donorMatches/one').responseStatus = 'Accepted'
  await assert.rejects(
    respond('alice', input('two')),
    /already have an active donation/,
  )
  assert.ok(!rows.has('donorCommitments/alice'))
})
test('a confirmed donation or a closed request releases the earlier commitment', async () => {
  for (const finish of [
    'fulfilled',
    'cancelled',
    'donated',
    'Deferred',
    'Rejected',
  ]) {
    const { rows, respond } = fixture()
    await respond('alice', input('one'))
    if (finish === 'donated') rows.set('donations/one', { donorId: 'alice' })
    else if (['Deferred', 'Rejected'].includes(finish))
      rows.get('donorMatches/one').screeningStatus = finish
    else rows.get('bloodRequests/one').status = finish
    await respond('alice', input('two'))
    assert.equal(rows.get('donorCommitments/alice').matchId, 'two')
  }
})
test('retrying the same acceptance is idempotent and does not duplicate consent', async () => {
  const { rows, respond } = fixture()
  await respond('alice', input('one'))
  await respond('alice', input('one'))
  assert.equal(
    [...rows.keys()].filter((key) => key.startsWith('donorConsents/')).length,
    2,
  )
})
test('declining requires no consent and can be accepted again with fresh consent', async () => {
  const { rows, respond } = fixture()
  await respond('alice', { matchId: 'one', responseStatus: 'Declined' })
  assert.ok(!rows.has('donorCommitments/alice'))
  assert.ok(!rows.has('donorConsents/one_data-sharing'))
  await respond('alice', input('one'))
  assert.equal(rows.get('donorMatches/one').responseStatus, 'Accepted')
})
test('wrong donor, closed request, suspension, incompatible blood and deferral are rejected atomically', async () => {
  for (const kind of ['owner', 'closed', 'suspended', 'blood', 'deferral']) {
    const { rows, respond } = fixture()
    if (kind === 'owner') rows.get('donorMatches/one').donorId = 'bob'
    if (kind === 'closed') rows.get('bloodRequests/one').status = 'cancelled'
    if (kind === 'suspended') rows.get('users/alice').status = 'Suspended'
    if (kind === 'blood') rows.get('bloodRequests/one').bloodType = 'A-'
    if (kind === 'deferral')
      rows.get('users/alice').lastDonationAt = new Date('2026-11-01')
    await assert.rejects(respond('alice', input('one')))
    assert.equal(rows.get('donorMatches/one').responseStatus, 'Pending')
    assert.ok(!rows.has('donorCommitments/alice'))
  }
})
test('acceptance requires literal consent booleans and valid coordinates', async () => {
  for (const extra of [
    { acknowledged: false },
    { dataSharingConsent: 'true' },
    { screeningConsent: false },
    { location: { latitude: 91, longitude: 120 } },
  ]) {
    const { respond } = fixture()
    await assert.rejects(respond('alice', { ...input('one'), ...extra }))
  }
})
test('alert read state is owner-only, atomic, and leaves delivery fields unchanged', async () => {
  const { rows, read } = fixture()
  rows.set('notifications/mine', { userId: 'alice', deliveryStatus: 'Sent' })
  rows.set('notifications/other', { userId: 'bob' })
  await assert.rejects(read('alice', ['mine', 'other']))
  assert.ok(!rows.get('notifications/mine').readAt)
  await read('alice', ['mine'])
  assert.ok(rows.get('notifications/mine').readAt)
  assert.equal(rows.get('notifications/mine').deliveryStatus, 'Sent')
})

test('withdrawing revokes consent and location atomically, and permits a later commitment', async () => {
  const { rows, respond } = fixture()
  await respond('alice', input('one'))
  await respond('alice', { matchId: 'one', responseStatus: 'Declined' })
  assert.equal(rows.get('donorMatches/one').donorLatitude, null)
  assert.ok(rows.get('donorConsents/one_data-sharing').revokedAt)
  assert.ok(rows.get('donorConsents/one_screening').revokedAt)
  await respond('alice', input('two'))
  assert.equal(rows.get('donorCommitments/alice').matchId, 'two')
})

test('withdraw and reaccept renews consent and acknowledgment, archives the old grant and resets unfinished progress', async () => {
  const {rows,respond}=fixture()
  await respond('alice',input('one'))
  rows.get('donorMatches/one').donationStage='Processing'
  rows.get('donorMatches/one').screeningStatus='Cleared'
  await respond('alice',{matchId:'one',responseStatus:'Declined'})
  assert.ok(rows.get('donorMatches/one').withdrawnAt)
  assert.equal(rows.has('donorCommitments/alice'),false)
  assert.ok(rows.get('donorConsents/one_data-sharing').revokedAt)
  await assert.rejects(respond('alice',{...input('one'),acknowledged:false}),{status:400})
  await respond('alice',input('one'))
  assert.equal(rows.get('donorMatches/one').donationStage,'Responded')
  assert.equal(rows.get('donorMatches/one').screeningStatus,null)
  assert.equal(rows.get('donorMatches/one').withdrawnAt,null)
  assert.equal(rows.get('donorMatches/one').acceptanceVersion,2)
  assert.equal(rows.get('donorConsents/one_data-sharing').revokedAt,null)
  assert.ok(rows.get('donorConsents/one_data-sharing_v1').revokedAt)
  await assert.rejects(respond('alice',input('two')),{status:409})
})

test('deferred, rejected and completed attempts never resume or get relabeled as withdrawal', async () => {
  for(const stage of ['Deferred','Rejected','Completed']) {
    const {rows,respond}=fixture()
    Object.assign(rows.get('donorMatches/one'),{responseStatus:'Accepted',donationStage:stage,screeningStatus:stage==='Completed'?'Cleared':stage})
    const before=structuredClone([...rows])
    await assert.rejects(respond('alice',{matchId:'one',responseStatus:'Declined'}),{status:409})
    await assert.rejects(respond('alice',input('one')),{status:409})
    assert.deepEqual([...rows],before)
    await respond('alice',input('two'))
  }
})

test('an expired invitation can be accepted again only while its underlying request is active', async () => {
  const {rows,respond}=fixture()
  rows.get('donorMatches/one').responseStatus='Expired'
  await respond('alice',input('one'))
  assert.equal(rows.get('donorMatches/one').donationStage,'Responded')
  const closed=fixture()
  closed.rows.get('donorMatches/one').responseStatus='Expired'
  closed.rows.get('bloodRequests/one').status='cancelled'
  await assert.rejects(closed.respond('alice',input('one')),{status:409})
})
