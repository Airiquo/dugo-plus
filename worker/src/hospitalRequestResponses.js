/** Request-scoped, bounded response pages with consent-gated donor contacts. */
import { HttpError } from './http.js'
import { donationStage, responseLabel, isCompletedDonation } from '../../web/src/utils/donationCompletion.js'

const ID = /^[^/\s]{1,128}$/
const PAGE_SIZE = 25
const STATUSES = ['Accepted', 'Declined', 'Pending', 'Expired']
const text = value => typeof value === 'string' ? value.trim() : ''
const active = record => record && (record.data.status || 'Active') === 'Active'
const date = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null

/** Reads one consistent page; `referenceName` supplies Firestore resource names. */
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
      // Each batch has at most 25 exact document references; profiles follow consent checks.
      const batch = async (collection, ids) => ids.length ? new Map((await tx.query({
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: '__name__' }, op: 'IN',
          value: { arrayValue: { values: [...new Set(ids)].map(id => ({ referenceValue: referenceName(collection + '/' + id) })) } } } },
        limit: PAGE_SIZE,
      })).map(record => [record.id, record])) : new Map()
      const page = matches.slice(0, PAGE_SIZE)
      const donations = await batch('donations', page.filter(match => !match.data.donationStage && match.data.responseStatus === 'Accepted').map(match => match.id))
      const accepted = page.filter(match => match.data.responseStatus === 'Accepted' && typeof match.data.donorId === 'string' && ID.test(match.data.donorId))
      const consents = await batch('donorConsents', accepted.map(match => match.id + '_data-sharing'))
      const permitted = new Set(accepted.filter(match => {
        const consent = consents.get(match.id + '_data-sharing')
        return consent?.data.donorId === match.data.donorId && consent.data.matchId === match.id
          && consent.data.consentType === 'Data Sharing' && consent.data.revokedAt === null
      }).map(match => match.id))
      const profiles = await batch('users', accepted.filter(match => permitted.has(match.id)).map(match => match.data.donorId))
      const rows = page.map(match => {
        const data = match.data
        let donor = null, privacy = 'consent-required'
        if (permitted.has(match.id)) {
          const record = profiles.get(data.donorId)
          if (active(record) && record.data.role === 'donor' && !record.data.personalDataErased) {
            donor = Object.fromEntries(['fullName', 'email', 'phoneNumber', 'bloodType', 'city'].map(key => [key, text(record.data[key])]))
            donor.gender = text(record.data.gender)
            donor.dateOfBirth = date(record.data.dateOfBirth)
            privacy = null
          } else privacy = 'profile-unavailable'
        }
        return { id: match.id, responseStatus: STATUSES.includes(data.responseStatus) ? data.responseStatus : 'Unknown',
          responseLabel: responseLabel(data), donationStage: isCompletedDonation(donations.get(match.id)?.data) ? 'Completed' : donationStage(data),
          acceptanceVersion: data.acceptanceVersion || 0, deferralReason: donor ? text(data.deferralReason) : '',
          screeningStatus: ['Cleared', 'Deferred', 'Rejected'].includes(data.screeningStatus) ? data.screeningStatus : null,
          matchedAt: date(data.matchedAt), acknowledgedAt: date(data.acknowledgedAt), donor, privacy }
      })
      return { ok: true, rows, nextCursor: matches.length > PAGE_SIZE ? rows.at(-1).id : null }
    })
  }
}
