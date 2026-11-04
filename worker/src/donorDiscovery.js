import { HttpError } from './http.js'
import { selectMatches } from './matcher.js'
import { donationTypeForComponent } from '../../web/src/utils/matching.js'

/** Explicit wider search creates only the caller's matches, without notification fan-out. */
export function createDonorDiscovery({ get, query, createMatches, referenceName }) {
  return async (uid, input = {}, now = new Date()) => {
    if (!input || typeof input !== 'object' || input.radiusKm !== 50) throw new HttpError(400, 'Choose the 50 km search option.')
    const donor = await get('users', uid)
    if (!donor || donor.data.role !== 'donor' || (donor.data.status || 'Active') !== 'Active' || donor.data.personalDataErased)
      throw new HttpError(403, 'An active donor account is required.')
    const requests = []
    let cursor = null
    do {
      const page = await query({ from: [{ collectionId: 'bloodRequests' }],
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: { arrayValue: { values: ['urgent', 'collecting'].map(stringValue => ({ stringValue })) } } } },
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
        ...(cursor ? { startAt: { values: [{ referenceValue: referenceName('bloodRequests/' + cursor) }], before: false } } : {}), limit: 100 })
      requests.push(...page)
      if (page.length < 100) break
      if (requests.length >= 1000) throw new HttpError(503, 'Wider search is busy. Please try again later.')
      cursor = page.at(-1).id
    } while (cursor)
    const types = new Map(), writes = []
    for (const request of requests) {
      if (!['urgent', 'collecting'].includes(request.data.status)) continue
      const typeId = donationTypeForComponent(request.data.component)
      if (!typeId) continue
      if (!types.has(typeId)) types.set(typeId, await get('donationTypes', typeId))
      const type = types.get(typeId)
      if (!type || type.data.isActive === false || !Number.isFinite(type.data.intervalDays) || type.data.intervalDays <= 0) continue
      const { matches } = selectMatches({ request: { ...request.data, id: request.id },
        requestPoint: { lat: request.data.latitude, lng: request.data.longitude }, donors: [donor],
        donationType: { id: typeId, intervalDays: type.data.intervalDays }, tier: { radiusKm: 50, number: 1 }, now })
      for (const match of matches) writes.push({ path: `donorMatches/${request.id}_${uid}`, data: match })
    }
    if (writes.length > 400) throw new HttpError(503, 'Wider search is busy. Please try again later.')
    const result = await createMatches(writes)
    return { ok: true, radiusKm: 50, ...result }
  }
}
