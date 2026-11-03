/** Request-scoped, consent-gated donor contacts for authorized facility staff. */
import { HttpError } from './http.js'

const ID = /^[^/\s]{1,128}$/
const PAGE_SIZE = 25
const STATUSES = ['Accepted', 'Declined', 'Pending', 'Expired']
const text = value => typeof value === 'string' ? value.trim() : ''
const active = record => record && (record.data.status || 'Active') === 'Active'
const date = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null

/** Reads one consistent page; `referenceName` returns a Firestore document resource name. */
export function createHospitalRequestResponses(store, referenceName) {
  return async (actor, input = {}) => {
    if (!actor?.uid) throw new HttpError(401, 'Sign in again to continue.')
    const { requestId, after = null, status = '' } = input
    if (typeof requestId !== 'string' || !ID.test(requestId)) throw new HttpError(400, 'Choose a valid request.')
    if (after !== null && (typeof after !== 'string' || !ID.test(after))) throw new HttpError(400, 'Invalid response page.')
    if (status !== '' && !STATUSES.includes(status)) throw new HttpError(400, 'Choose a valid response filter.')
    return store.transact(async tx => {
      const profile = await tx.get('users', actor.uid)
      const admin = actor.claims?.role === 'admin' && profile?.data.role === 'admin'
      const staff = ['staff', 'hospital'].includes(actor.claims?.role) && profile?.data.role === 'hospital'
        && profile.data.hospitalId && profile.data.hospitalId === actor.claims.hospitalId
      if (!active(profile) || (!admin && !staff)) throw new HttpError(403, 'An active hospital staff account is required.')
      const request = await tx.get('bloodRequests', requestId)
      if (!request) throw new HttpError(404, 'This request no longer exists.')
      if (!admin && request.data.hospitalId !== actor.claims.hospitalId) throw new HttpError(403, 'This request belongs to another facility.')
      if (!active(await tx.get('hospitals', request.data.hospitalId))) throw new HttpError(403, 'Your facility is not active. Contact your administrator.')
      const filters = [{ fieldFilter: { field: { fieldPath: 'requestId' }, op: 'EQUAL', value: { stringValue: requestId } } }]
      if (status) filters.push({ fieldFilter: { field: { fieldPath: 'responseStatus' }, op: 'EQUAL', value: { stringValue: status } } })
      const matches = await tx.query({
        from: [{ collectionId: 'donorMatches' }],
        where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } },
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
        ...(after ? { startAt: { values: [{ referenceValue: referenceName('donorMatches/' + after) }], before: false } } : {}),
        limit: PAGE_SIZE + 1,
      })
      const rows = []
      for (const match of matches.slice(0, PAGE_SIZE)) {
        const data = match.data
        let donor = null, privacy = 'consent-required'
        if (data.responseStatus === 'Accepted' && typeof data.donorId === 'string' && ID.test(data.donorId)) {
          const consent = await tx.get('donorConsents', match.id + '_data-sharing')
          if (consent?.data.donorId === data.donorId && consent.data.matchId === match.id
              && consent.data.consentType === 'Data Sharing' && consent.data.revokedAt === null) {
            const record = await tx.get('users', data.donorId)
            if (active(record) && record.data.role === 'donor' && !record.data.personalDataErased) {
              donor = Object.fromEntries(['fullName', 'email', 'phoneNumber', 'bloodType', 'city'].map(key => [key, text(record.data[key])]))
              privacy = null
            } else privacy = 'profile-unavailable'
          }
        }
        rows.push({ id: match.id, responseStatus: STATUSES.includes(data.responseStatus) ? data.responseStatus : 'Unknown',
          screeningStatus: ['Cleared', 'Deferred', 'Rejected'].includes(data.screeningStatus) ? data.screeningStatus : null,
          matchedAt: date(data.matchedAt), acknowledgedAt: date(data.acknowledgedAt), donor, privacy })
      }
      return { ok: true, rows, nextCursor: matches.length > PAGE_SIZE ? rows.at(-1).id : null }
    })
  }
}
