/** Bounded facility donation history and on-demand, consent-gated context. */
import { HttpError } from './http.js'
import { isCompletedDonation } from '../../web/src/utils/donationCompletion.js'
const ID = /^[^/\s]{1,128}$/
const active = record => record && (record.data.status || 'Active') === 'Active'
const text = value => typeof value === 'string' ? value.trim() : ''
const date = value => value instanceof Date && Number.isFinite(+value) ? value.toISOString() : null
function id(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new HttpError(400, 'Choose a valid record reference.')
  return value
}
export function completedDonationRow(record) {
  const data = record.data
  return { id: record.id, ...Object.fromEntries(['matchId', 'requestId', 'donorId', 'hospitalId', 'bloodType', 'component'].map(key => [key, text(data[key])])),
    matchId: text(data.matchId) || record.id, units: data.units, donationDate: date(data.donationDate), status: 'Completed',
    completedAt: date(data.completedAt || data.confirmedAt), completedBy: text(data.completedBy || data.confirmedBy), legacy: data.status !== 'Completed' }
}
async function authorize(tx, actor, hospitalId) {
  if (!actor?.uid) throw new HttpError(401, 'Sign in again to continue.')
  const profile = await tx.get('users', actor.uid)
  const admin = actor.claims?.role === 'admin' && profile?.data.role === 'admin'
  const staff = ['staff', 'hospital'].includes(actor.claims?.role) && profile?.data.role === 'hospital'
    && profile.data.hospitalId === actor.claims.hospitalId && actor.claims.hospitalId === hospitalId
  if (!active(profile) || (!admin && !staff)) throw new HttpError(403, 'An active authorized facility account is required.')
  if (!active(await tx.get('hospitals', hospitalId))) throw new HttpError(403, 'This facility is not active.')
}
/** Returns 25 rows with a document-name cursor; no per-row profile joins. */
export function createHospitalDonationReader(store, referenceName) {
  return async (actor, input = {}) => store.transact(async tx => {
    const hospitalId = id(input.hospitalId)
    await authorize(tx, actor, hospitalId)
    if (input.donationId) {
      const record = await tx.get('donations', id(input.donationId))
      if (!record || record.data.hospitalId !== hospitalId || !isCompletedDonation(record.data) || ['donorId', 'requestId'].some(key => input[key] && record.data[key] !== id(input[key]))) throw new HttpError(404, 'This completed donation is unavailable.')
      return { ok: true, rows: [completedDonationRow(record)], nextCursor: null }
    }
    const filters = ['hospitalId', 'donorId', 'requestId'].filter(key => key === 'hospitalId' || input[key]).map(key => ({
      fieldFilter: { field: { fieldPath: key }, op: 'EQUAL', value: { stringValue: id(input[key]) } },
    }))
    const records = await tx.query({ from: [{ collectionId: 'donations' }],
      where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit: 26,
      ...(input.after ? { startAt: { values: [{ referenceValue: referenceName('donations/' + id(input.after)) }], before: false } } : {}) })
    const page = records.slice(0, 25)
    return { ok: true, rows: page.filter(record => isCompletedDonation(record.data)).map(completedDonationRow),
      nextCursor: records.length > 25 ? page.at(-1).id : null }
  })
}
/** Reads one donation and its request; private donor fields require current consent. */
export function createHospitalDonationDetails(store) {
  return async (actor, input = {}) => store.transact(async tx => {
    if (!actor?.uid) throw new HttpError(401, 'Sign in again to continue.')
    const record = await tx.get('donations', id(input.donationId))
    if (!record || !isCompletedDonation(record.data)) throw new HttpError(404, 'This completed donation is unavailable.')
    await authorize(tx, actor, id(record.data.hospitalId))
    const matchId = record.data.matchId || record.id
    const match = await tx.get('donorMatches', id(matchId))
    const requestId = record.data.requestId || match?.data.requestId
    const request = requestId ? await tx.get('bloodRequests', id(requestId)) : null
    let donor = null, privacy = 'consent-required'
    const consent = await tx.get('donorConsents', `${matchId}_data-sharing`)
    if (consent?.data.matchId === matchId && consent.data.donorId === record.data.donorId
        && consent.data.consentType === 'Data Sharing' && consent.data.revokedAt === null) {
      const profile = await tx.get('users', id(record.data.donorId))
      if (active(profile) && profile.data.role === 'donor' && !profile.data.personalDataErased) {
        donor = Object.fromEntries(['fullName', 'email', 'phoneNumber', 'bloodType', 'city'].map(key => [key, text(profile.data[key])]))
        privacy = null
      } else privacy = 'profile-unavailable'
    }
    return { ok: true, donation: { ...completedDonationRow(record), requestId: requestId || '' }, donor, privacy,
      request: request?.data.hospitalId === record.data.hospitalId ? { id: request.id,
        ...Object.fromEntries(['bloodType', 'component', 'quantity', 'status'].map(key => [key, request.data[key] ?? null])) } : null }
  })
}
