import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toDate } from '../utils/eligibility'

/**
 * Partnership subscriptions — `hospitals/{hospitalId}/subscriptions/{id}`
 * (schema §2.3.1, FR-018, D28).
 *
 * Staff can view the current tier, change/renew the subscription, or review
 * subscription history.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export const PARTNERSHIP_PLANS = [
  {
    id: 'community',
    name: 'Community Plan',
    tier: 'Basic Access',
    price: 'Free / Subsidized',
    period: 'Standard 12-month cycle',
    description: 'Essential connectivity for community clinics and municipal health units.',
    features: [
      'Inventory stock monitoring (all 8 blood types)',
      'Local blood request broadcasts',
      'Basic donor notification dispatch',
      'Single-workstation hospital access',
    ],
  },
  {
    id: 'standard',
    name: 'Standard Partner',
    tier: 'Recommended',
    price: '₱4,500 / month',
    period: 'Annual partnership plan',
    popular: true,
    description: 'Comprehensive blood bank management with emergency broadcasting and tiered radius.',
    features: [
      'Full inventory movement and transaction audit logs',
      'Tiered radius emergency donor broadcast (5–25 km)',
      'Multi-staff concurrent operational access',
      'Direct donor matching and screening pipeline',
      'Facility geolocation & map routing integration',
    ],
  },
  {
    id: 'regional',
    name: 'Regional Network',
    tier: 'Enterprise',
    price: '₱12,000 / month',
    period: 'Apex facility & network plan',
    description: 'Advanced coordination for apex medical centers, blood centers, and multi-branch networks.',
    features: [
      'All Standard Partner features included',
      'Inter-hospital transfer and mutual aid coordination',
      'Priority emergency request routing',
      'Collection trend analytics and reporting summaries',
      'Dedicated partner liaison and technical SLA',
    ],
  },
]

/**
 * Read all subscriptions for a hospital, newest first.
 *
 * @param {string} hospitalId
 * @returns {Promise<Array<{
 *   id: string, plan: string, startDate: Date|null, endDate: Date|null, status: string
 * }>>}
 */
export async function getHospitalSubscriptions(hospitalId) {
  requireDb()
  const id = text(hospitalId)
  if (!id) return []

  const snap = await getDocs(collection(db, 'hospitals', id, 'subscriptions'))
  const rows = snap.docs.map((docSnap) => {
    const data = docSnap.data() ?? {}
    return {
      id: docSnap.id,
      plan: text(data.plan) || 'Standard Partner',
      startDate: toDate(data.startDate),
      endDate: toDate(data.endDate),
      status: text(data.status) || 'Active',
    }
  })

  // Order newest by startDate descending
  return rows.sort((a, b) => {
    const timeA = a.startDate ? a.startDate.getTime() : 0
    const timeB = b.startDate ? b.startDate.getTime() : 0
    return timeB - timeA
  })
}

/**
 * Find the currently active subscription.
 *
 * @param {Array<{id: string, plan: string, startDate: Date|null, endDate: Date|null, status: string}>} subscriptions
 * @returns {{id: string, plan: string, startDate: Date|null, endDate: Date|null, status: string} | null}
 */
export function getActiveSubscription(subscriptions) {
  if (!Array.isArray(subscriptions) || !subscriptions.length) return null
  const now = Date.now()
  // First look for Active status where endDate is in the future
  const active = subscriptions.find(
    (sub) => sub.status === 'Active' && sub.endDate && sub.endDate.getTime() >= now,
  )
  if (active) return active
  // Fall back to any active status
  return subscriptions.find((sub) => sub.status === 'Active') ?? subscriptions[0] ?? null
}

/**
 * Update or activate a hospital partnership plan (FR-018).
 *
 * @param {string} hospitalId
 * @param {{
 *   plan: string,
 *   durationMonths?: number,
 *   existingId?: string|null,
 * }} options
 */
export async function saveHospitalSubscription(
  hospitalId,
  { plan, durationMonths = 12, existingId = null },
) {
  requireDb()
  const id = text(hospitalId)
  if (!id) throw new Error('Facility ID is missing.')

  const planName = text(plan)
  if (!planName) throw new Error('Please select a valid partnership plan.')

  const startDate = new Date()
  const endDate = new Date(startDate.getTime() + durationMonths * 30 * 86400 * 1000)

  // If there is an existing active subscription being upgraded/replaced, expire it
  if (existingId) {
    try {
      await updateDoc(doc(db, 'hospitals', id, 'subscriptions', existingId), {
        status: 'Expired',
      })
    } catch {
      // Non-fatal if previous record cannot be modified
    }
  }

  const docRef = await addDoc(collection(db, 'hospitals', id, 'subscriptions'), {
    plan: planName,
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    status: 'Active',
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

/**
 * Cancel an active subscription.
 *
 * @param {string} hospitalId
 * @param {string} subscriptionId
 */
export async function cancelHospitalSubscription(hospitalId, subscriptionId) {
  requireDb()
  const hId = text(hospitalId)
  const sId = text(subscriptionId)
  if (!hId || !sId) throw new Error('Invalid subscription reference.')

  await updateDoc(doc(db, 'hospitals', hId, 'subscriptions', sId), {
    status: 'Cancelled',
  })
}
