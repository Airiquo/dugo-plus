export * from '../../web/src/services/dataRequests.js'
export async function listMyDataRequests() { return [] }
export async function createDataRequest(uid, type, details) {
  window.fixture.writes.push({ kind: 'privacy', uid, type, details })
}
