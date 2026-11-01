import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeDocument,
  documentName,
  fromFirestoreValue,
  toFirestoreFields,
  toFirestoreValue,
} from './firestore.js'

const env = {
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
    project_id: 'demo-dugo',
    client_email: 'worker@demo-dugo.iam.gserviceaccount.com',
    private_key: 'unused-in-these-tests',
  }),
}

test('document names include the service account project', () => {
  assert.equal(
    documentName(env, 'bloodRequests/request-1'),
    'projects/demo-dugo/databases/(default)/documents/bloodRequests/request-1',
  )
})

test('Firestore values round-trip through their tagged forms', () => {
  const values = [
    'hello',
    42,
    4.2,
    true,
    null,
    new Date('2026-06-01T12:00:00Z'),
    ['a', 1, false],
    { nested: { count: 2, label: 'x' } },
  ]
  for (const value of values) {
    const tagged = toFirestoreValue(value)
    const decoded = fromFirestoreValue(tagged)
    if (value instanceof Date) {
      assert.equal(decoded.toISOString(), value.toISOString())
    } else {
      assert.deepEqual(decoded, value)
    }
  }
})

test('undefined fields are omitted from a fields map', () => {
  assert.deepEqual(toFirestoreFields({ a: 1, b: undefined, c: null }), {
    a: { integerValue: '1' },
    c: { nullValue: null },
  })
})

test('decodeDocument exposes id, data, and updateTime', () => {
  const decoded = decodeDocument({
    name: 'projects/demo-dugo/databases/(default)/documents/bloodRequests/request-1',
    updateTime: '2026-06-01T12:00:00Z',
    fields: {
      status: { stringValue: 'collecting' },
      matching: {
        mapValue: {
          fields: {
            currentTier: { integerValue: '1' },
            exhausted: { booleanValue: false },
          },
        },
      },
    },
  })
  assert.equal(decoded.id, 'request-1')
  assert.equal(decoded.data.status, 'collecting')
  assert.deepEqual(decoded.data.matching, { currentTier: 1, exhausted: false })
  assert.equal(decoded.updateTime, '2026-06-01T12:00:00Z')
})
