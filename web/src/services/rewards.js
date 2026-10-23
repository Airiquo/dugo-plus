import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toDate } from '../utils/eligibility'

/**
 * Reward points — `rewardTransactions/{donationId}` (schema §2.10). One record
 * per donation, written server-side, and the donor's total is summed on read
 * (D12). Nothing is stored on the profile, so the total can never drift from
 * the rows it is made of.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Firestore's local copy of `request.auth.uid`; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/**
 * The signed-in donor's points, newest first, with their total (FR-009).
 *
 * Sorted here rather than by a query: a `donorId` equality alone is served by
 * the automatic single-field index, while adding `orderBy('awardedAt')` would
 * need a composite index the schema does not list.
 *
 * @param {string} uid
 * @returns {Promise<{
 *   entries: Array<{ donationId: string, points: number, awardedAt: Date|null }>,
 *   total: number,
 * }>}
 */
export async function listDonorPoints(uid) {
  requireDb()
  const snap = await getDocs(
    query(collection(db, 'rewardTransactions'), where('donorId', '==', uid)),
  )
  const entries = snap.docs.map((entry) => {
    const data = entry.data() ?? {}
    return {
      donationId: typeof data.donationId === 'string' ? data.donationId : entry.id,
      points: Number(data.points) || 0,
      awardedAt: toDate(data.awardedAt),
    }
  })
  entries.sort((a, b) => (b.awardedAt?.getTime() ?? 0) - (a.awardedAt?.getTime() ?? 0))
  return { entries, total: entries.reduce((sum, entry) => sum + entry.points, 0) }
}
