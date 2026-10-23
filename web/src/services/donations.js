import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toDate } from '../utils/eligibility'

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
 * Reference data: `donationTypes/{id}`. Four documents, seeded by
 * `scripts/seed-reference-data.mjs`, each carrying its D13 `intervalDays`.
 *
 * @returns {Promise<Array<{ id: string, name: string, intervalDays: number }>>}
 */
export async function listDonationTypes() {
  requireDb()
  const snap = await getDocs(collection(db, 'donationTypes'))
  return snap.docs.map((entry) => {
    const data = entry.data() ?? {}
    return {
      id: entry.id,
      name: text(data.name) || entry.id,
      intervalDays: Number(data.intervalDays) || 0,
    }
  })
}

/**
 * Attach each donation's component and interval by reading its match. A failed
 * match read costs the component, not the row: the donation still renders from
 * its own record, and the tracker falls back to the longest interval.
 */
async function withComponents(docs) {
  const rows = docs.map((entry) => ({ id: entry.id, data: entry.data() ?? {} }))
  const [types, matches] = await Promise.all([
    listDonationTypes(),
    Promise.all(rows.map((row) => getDoc(doc(db, 'donorMatches', row.id)).catch(() => null))),
  ])
  const typesById = new Map(types.map((type) => [type.id, type]))

  return rows.map((row, index) => {
    const match = matches[index]?.exists() ? matches[index].data() : null
    const donationTypeId = text(match?.donationTypeId)
    const type = typesById.get(donationTypeId) ?? null
    return {
      id: row.id,
      donationDate: toDate(row.data.donationDate),
      confirmedAt: toDate(row.data.confirmedAt),
      units: Number(row.data.units) || 0,
      bloodType: text(row.data.bloodType),
      hospitalId: text(row.data.hospitalId),
      donationTypeId,
      donationTypeName: type?.name ?? '',
      intervalDays: type?.intervalDays && type.intervalDays > 0 ? type.intervalDays : 0,
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
  return withComponents(snap.docs)
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
  const rows = await withComponents(snap.docs)
  return rows[0] ?? null
}
