import { collection, documentId, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { donationTypeForComponent } from '../utils/matching'
import { isCompletedDonation } from '../utils/donationCompletion'
import { toDate } from '../utils/eligibility'
import { listDonationTypes } from './donationTypes'
export { listDonationTypes } from './donationTypes'

/**
 * Donation records — `donations/{matchId}` (schema §2.9). The doc ID is the
 * match, so the donation's type is read from `donorMatches` and its interval
 * from `donationTypes` (D13); the rules allow a donor to read their own
 * donation, the match and the reference data.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Firestore's local copy of `request.auth.uid`; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** A donor's donations, newest first. The index is schema §4's donation query. */
function donorDonationsQuery(uid) {
  return query(
    collection(db, 'donations'),
    where('donorId', '==', uid),
    orderBy('donationDate', 'desc'),
  )
}

/**
 * Resolve new records from their component/type; batch legacy match references
 * in groups of 10. Failed reads remain errors so history is never partial.
 */
async function withComponents(docs, uid) {
  const rows = docs.map(entry => ({ id: entry.id, data: entry.data() ?? {} })).filter(row => isCompletedDonation(row.data))
  const types = await listDonationTypes()
  const typesById = new Map(types.map(type => [type.id, type]))
  const missing = rows.filter(row => !text(row.data.donationType) && !donationTypeForComponent(row.data.component))
  const matches = new Map()
  for (let offset = 0; offset < missing.length; offset += 10) {
    const snap = await getDocs(query(collection(db, 'donorMatches'), where('donorId', '==', uid), where(documentId(), 'in', missing.slice(offset, offset + 10).map(row => row.id))))
    for (const entry of snap.docs) matches.set(entry.id, entry.data())
  }
  return rows.map(row => {
    const donationTypeId = text(row.data.donationType) || donationTypeForComponent(row.data.component) || text(matches.get(row.id)?.donationTypeId)
    const type = typesById.get(donationTypeId) ?? null
    return {
      id: row.id, donationDate: toDate(row.data.donationDate),
      completedAt: toDate(row.data.completedAt || row.data.confirmedAt),
      confirmedAt: toDate(row.data.completedAt || row.data.confirmedAt),
      units: Number(row.data.units) || 0, bloodType: text(row.data.bloodType),
      hospitalId: text(row.data.hospitalId), donationTypeId,
      donationTypeName: type?.name ?? '', intervalDays: type?.intervalDays > 0 ? type.intervalDays : 0,
    }
  })
}

/**
 * The signed-in donor's donations, newest first (FR-008, FR-010).
 *
 * @param {string} uid
 * @returns {Promise<Array<{
 *   id: string, donationDate: Date|null, confirmedAt: Date|null, units: number,
 *   bloodType: string, hospitalId: string, donationTypeId: string,
 *   donationTypeName: string, intervalDays: number,
 * }>>}
 */
export async function listDonorDonations(uid) {
  requireDb()
  const snap = await getDocs(donorDonationsQuery(uid))
  return withComponents(snap.docs, uid)
}

/**
 * The donor's most recent donation, or `null` when there is none. One document,
 * for callers that only need the component behind `users.lastDonationAt` (D13).
 *
 * @param {string} uid
 * @returns {Promise<{
 *   id: string, donationDate: Date|null, confirmedAt: Date|null, units: number,
 *   bloodType: string, hospitalId: string, donationTypeId: string,
 *   donationTypeName: string, intervalDays: number,
 * } | null>}
 */
export async function latestDonorDonation(uid) {
  requireDb()
  const snap = await getDocs(query(donorDonationsQuery(uid), limit(1)))
  const rows = await withComponents(snap.docs, uid)
  return rows[0] ?? null
}
