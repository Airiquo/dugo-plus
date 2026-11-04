/** Bounded facility donor directory and completed history; profile reads require visit-specific consent. */
import { HttpError } from './http.js'

const ID = /^[^/\s]{1,128}$/
const SIZE = 25
const active = record => record && (record.data.status || 'Active') === 'Active'
const iso = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null
const completed = data => data.status === 'Completed' || Boolean(iso(data.confirmedAt))
const equal = (fieldPath, value) => ({ fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } })
const safeText = value => typeof value === 'string' ? value.trim() : ''

function donation(record) {
  const d = record.data
  return { id: record.id, matchId: d.matchId || record.id, donorId: d.donorId, hospitalId: d.hospitalId,
    requestId: safeText(d.requestId), bloodType: safeText(d.bloodType), component: safeText(d.component),
    units: Number.isInteger(d.units) && d.units > 0 ? d.units : null,
    donationDate: iso(d.donationDate), completedAt: iso(d.completedAt) || iso(d.confirmedAt),
    status: 'Completed', legacy: d.status !== 'Completed' }
}

/** `referenceName` builds a Firestore document resource name; all related reads share one transaction. */
export function createHospitalDonors(store, referenceName) {
  return async (actor, input = {}) => {
    if (!actor?.uid) throw new HttpError(401, 'Sign in again to continue.')
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Choose a valid directory view.')
    const { hospitalId, donorId = '', after = null } = input
    for (const value of [hospitalId, ...(donorId ? [donorId] : []), ...(after !== null ? [after] : [])])
      if (typeof value !== 'string' || !ID.test(value)) throw new HttpError(400, 'Choose a valid facility, donor or page reference.')
    if (typeof donorId !== 'string') throw new HttpError(400, 'Choose a valid donor reference.')
    return store.transact(async tx => {
      const profile = await tx.get('users', actor.uid)
      if (!active(profile) || profile.data.personalDataErased || profile.data.role !== 'hospital' || !['staff', 'hospital'].includes(actor.claims?.role)
          || profile.data.hospitalId !== hospitalId || actor.claims.hospitalId !== hospitalId)
        throw new HttpError(403, 'An active staff account linked to this facility is required.')
      if (!active(await tx.get('hospitals', hospitalId))) throw new HttpError(403, 'Your facility is not active. Contact your administrator.')
      const filters = [equal('hospitalId', hospitalId)]
      if (donorId) filters.push(equal('donorId', donorId))
      const order = donorId ? '__name__' : 'donorId'
      const page = await tx.query({ from: [{ collectionId: 'donations' }],
        where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } },
        orderBy: [{ field: { fieldPath: order }, direction: 'ASCENDING' }],
        ...(after ? { startAt: { values: [donorId ? { referenceValue: referenceName('donations/' + after) } : { stringValue: after }], before: false } } : {}),
        limit: SIZE + 1 })
      if (donorId) return { ok: true, rows: page.slice(0, SIZE).filter(row => completed(row.data)).map(donation),
        nextCursor: page.length > SIZE ? page[SIZE - 1].id : null }
      const records = page.slice(0, SIZE)
      const byDonor = new Map()
      for (const row of records) if (typeof row.data.donorId === 'string' && ID.test(row.data.donorId) && completed(row.data) && !byDonor.has(row.data.donorId)) byDonor.set(row.data.donorId, row)
      const lastDonor = records.at(-1)?.data.donorId
      // The cursor excludes every visit by the last donor, including visits beyond this page.
      const remaining = lastDonor ? await tx.query({ from: [{ collectionId: 'donations' }], where: equal('hospitalId', hospitalId),
        orderBy: [{ field: { fieldPath: 'donorId' }, direction: 'ASCENDING' }],
        startAt: { values: [{ stringValue: lastDonor }], before: false }, limit: 1 }) : []
      const readIds = async (collectionId, ids) => ids.length ? tx.query({ from: [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath: '__name__' }, op: 'IN', value: { arrayValue: { values: ids.map(id => ({ referenceValue: referenceName(collectionId + '/' + id) })) } } } }, limit: SIZE }) : []
      const visits = [...byDonor.values()]
      const consentVisits = visits.filter(row => !row.data.matchId || row.data.matchId === row.id)
      const consents = new Map((await readIds('donorConsents', consentVisits.map(row => (row.data.matchId || row.id) + '_data-sharing'))).map(row => [row.id, row.data]))
      const allowed = consentVisits.filter(row => {
        const matchId = row.data.matchId || row.id, consent = consents.get(matchId + '_data-sharing')
        return consent?.donorId === row.data.donorId && consent.matchId === matchId && consent.consentType === 'Data Sharing' && consent.revokedAt === null
      })
      const profiles = new Map((await readIds('users', allowed.map(row => row.data.donorId))).map(row => [row.id, row]))
      const rows = visits.map(row => {
        const record = profiles.get(row.data.donorId)
        const donor = active(record) && record.data.role === 'donor' && !record.data.personalDataErased
          ? Object.fromEntries(['fullName', 'email', 'phoneNumber', 'bloodType', 'city'].map(key => [key, safeText(record.data[key])])) : null
        if (donor) { donor.gender = safeText(record.data.gender); donor.dateOfBirth = iso(record.data.dateOfBirth) }
        return { id: row.data.donorId, donor, privacy: donor ? null : record ? 'profile-unavailable' : 'consent-required' }
      })
      return { ok: true, rows, nextCursor: remaining.length ? lastDonor : null }
    })
  }
}
