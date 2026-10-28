import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function shape(entry) {
  const data = entry.data() ?? {}
  return {
    id: entry.id,
    requestId: text(data.requestId),
    donorId: text(data.donorId),
    donationTypeId: text(data.donationTypeId),
    screenedByUserId: text(data.screenedByUserId) || null,
    responseStatus: text(data.responseStatus) || 'Pending',
    screeningStatus: text(data.screeningStatus) || null,
    guidelinesAcknowledged: Boolean(data.guidelinesAcknowledged),
    acknowledgedAt: data.acknowledgedAt ?? null,
    matchedAt: data.matchedAt ?? null,
    donorLatitude: num(data.donorLatitude),
    donorLongitude: num(data.donorLongitude),
    locationSharedAt: data.locationSharedAt ?? null,
  }
}

/** The signed-in donor's matches, live (FR-006). */
export function listenDonorMatches(uid, callback) {
  requireDb()
  return onSnapshot(
    query(collection(db, 'donorMatches'), where('donorId', '==', uid)),
    (snap) => callback(snap.docs.map(shape)),
    (error) => {
      console.error(error)
      callback([])
    },
  )
}

export async function getMatch(matchId) {
  requireDb()
  const snap = await getDoc(doc(db, 'donorMatches', matchId))
  return snap.exists() ? shape(snap) : null
}

/**
 * The donor's answer to a match (FR-006, FR-030). `location` is the donor's
 * current position, shared with the request's hospital and nobody else (D27);
 * omit it when geolocation is unavailable.
 *
 * @param {string} matchId
 * @param {'Accepted'|'Declined'} responseStatus
 * @param {{ latitude: number, longitude: number } | null} [location]
 */
export async function respondToMatch(matchId, responseStatus, location = null) {
  requireDb()
  if (responseStatus !== 'Accepted' && responseStatus !== 'Declined') {
    throw new Error('Invalid response status')
  }
  const shared =
    location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
      ? {
          donorLatitude: location.latitude,
          donorLongitude: location.longitude,
          locationSharedAt: serverTimestamp(),
        }
      : {}
  await updateDoc(doc(db, 'donorMatches', matchId), {
    responseStatus,
    guidelinesAcknowledged: true,
    acknowledgedAt: serverTimestamp(),
    ...shared,
  })
}

/** Every match for one request, for the hospital-side view (F6). */
export async function listMatchesForRequest(requestId) {
  requireDb()
  const snap = await getDocs(
    query(collection(db, 'donorMatches'), where('requestId', '==', requestId)),
  )
  return snap.docs.map(shape)
}
