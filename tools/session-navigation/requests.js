export * from '../../web/src/services/requests.js'
export async function fetchHospital() {
  return { id: 'fixture-hospital', name: 'Fixture hospital', address: 'Fixture city', latitude: 14.6, longitude: 121 }
}
export async function createRequest(input) {
  window.fixture.writes.push({ kind: 'request', input })
  return 'fixture-request'
}
