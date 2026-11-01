import test from 'node:test'
import assert from 'node:assert/strict'
import { accountOperationRequest } from './accountOperationRequest.js'

function setup() {
  const values = new Map()
  const requests = []
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const options = {
    url: 'https://example.test/accounts',
    actorId: crypto.randomUUID(),
    token: 'test-token',
    action: 'createHospitalAccount',
    payload: {
      email: 'test@example.test',
      password: 'never-store-this-password',
    },
    storage,
  }
  const response = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  return {
    values,
    requests,
    options,
    response,
    fetcher: async (url, init) => {
      const body = JSON.parse(init.body)
      requests.push(body)
      return body.action === 'capabilities'
        ? response({ accountOperationsVersion: 2 })
        : response({ state: 'Completed', uid: 'test' })
    },
  }
}

test('client reuses its operation ID after network failure, without persisting credentials', async () => {
  const state = setup()
  let fail = true
  const fetcher = async (url, init) => {
    const body = JSON.parse(init.body)
    if (body.action !== 'capabilities' && fail) {
      state.requests.push(body)
      throw new Error('offline')
    }
    return state.fetcher(url, init)
  }
  await assert.rejects(
    () => accountOperationRequest({ ...state.options, fetcher }),
    /could not be reached/,
  )
  assert.equal(state.values.size, 1)
  assert.ok(
    !JSON.stringify([...state.values]).includes('never-store-this-password'),
  )
  fail = false
  await accountOperationRequest({ ...state.options, fetcher })
  const mutations = state.requests.filter(
    (body) => body.action !== 'capabilities',
  )
  assert.equal(mutations[0].operationId, mutations[1].operationId)
  assert.equal(state.values.size, 0)
})

test('pending response preserves its retry ID and does not report success', async () => {
  const state = setup()
  const fetcher = async (url, init) =>
    JSON.parse(init.body).action === 'capabilities'
      ? state.fetcher(url, init)
      : state.response({ state: 'Pending', message: 'Still processing' })
  await assert.rejects(
    () => accountOperationRequest({ ...state.options, fetcher }),
    /Still processing/,
  )
  assert.equal(state.values.size, 1)
})

test('old servers cannot receive an unsafe mutation from the new client', async () => {
  const state = setup()
  const requests = []
  await assert.rejects(
    () =>
      accountOperationRequest({
        ...state.options,
        fetcher: async (url, init) => {
          requests.push(JSON.parse(init.body))
          return state.response({ error: 'Unknown action' }, 400)
        },
      }),
    /temporarily unavailable/,
  )
  assert.deepEqual(
    requests.map((body) => body.action),
    ['capabilities'],
  )
})

test('definitive validation failures clear retry state', async () => {
  const state = setup()
  const fetcher = async (url, init) =>
    JSON.parse(init.body).action === 'capabilities'
      ? state.fetcher(url, init)
      : state.response({ error: 'Invalid email' }, 400)
  await assert.rejects(
    () => accountOperationRequest({ ...state.options, fetcher }),
    /Invalid email/,
  )
  assert.equal(state.values.size, 0)
})

test('unavailable browser storage still supports retry IDs in memory', async () => {
  const state = setup()
  const brokenStorage = {
    getItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
    removeItem() {
      throw new Error('blocked')
    },
  }
  const options = {
    ...state.options,
    storage: brokenStorage,
    fetcher: state.fetcher,
  }
  assert.equal((await accountOperationRequest(options)).uid, 'test')
})
