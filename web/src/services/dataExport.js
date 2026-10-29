import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { readProfile } from './users'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** Turn a Firestore value into something JSON can hold. */
function plain(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(plain)
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]))
  }
  return value
}

function rows(snap) {
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...plain(docSnap.data()) }))
}

async function byField(collectionName, field, value) {
  const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)))
  return rows(snap)
}

/**
 * The personal data Dugo+ holds for one account, assembled for an access or
 * export request (FR-039/NFR-19). Admin claim required: every read below is an
 * admin path in `firestore.rules`.
 *
 * Records that are not personal data (the audit chain, other people's
 * documents) are deliberately left out.
 *
 * @param {string} uid
 * @returns {Promise<object>} a JSON-ready bundle
 */
export async function collectUserData(uid) {
  requireDb()
  if (!uid) throw new Error('Choose an account first.')

  const [profile, matches, donations, rewards, consents, requests, bloodRequests] =
    await Promise.all([
      readProfile(uid),
      byField('donorMatches', 'donorId', uid),
      byField('donations', 'donorId', uid),
      byField('rewardTransactions', 'donorId', uid),
      byField('donorConsents', 'donorId', uid),
      byField('dataSubjectRequests', 'userId', uid),
      byField('bloodRequests', 'createdBy', uid),
    ])

  return {
    exportedAt: new Date().toISOString(),
    subject: { uid },
    profile: plain(profile),
    donorMatches: matches,
    donations,
    rewardTransactions: rewards,
    donorConsents: consents,
    dataSubjectRequests: requests,
    bloodRequestsPosted: bloodRequests,
    notes: [
      'The audit chain (auditBlocks) stores hashed references and is not personal data.',
      'Records belonging to other accounts are not included.',
    ],
  }
}

/**
 * Save a bundle to the administrator's machine as a JSON file. The whole export
 * stays in the browser; nothing is uploaded anywhere.
 *
 * @param {object} bundle from `collectUserData`
 * @param {string} uid
 */
export function downloadUserData(bundle, uid) {
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `dugo-plus-data-${uid}-${stamp}.json`
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke on the next tick so the click has picked the URL up.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return filename
}
