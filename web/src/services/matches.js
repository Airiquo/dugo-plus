import { callDonorService } from './donorApi'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
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
    donationStage: text(data.donationStage) || null,
    withdrawnAt: data.withdrawnAt ?? null,
    acceptanceVersion: data.acceptanceVersion || 0,
    guidelinesAcknowledged: Boolean(data.guidelinesAcknowledged),
    acknowledgedAt: data.acknowledgedAt ?? null,
    matchedAt: data.matchedAt ?? null,
    donorLatitude: num(data.donorLatitude),
    donorLongitude: num(data.donorLongitude),
    locationSharedAt: data.locationSharedAt ?? null,
  }
}

/** The signed-in donor's matches, live (FR-006). */
export function listenDonorMatches(uid, callback, onError = () => {}) {
  requireDb()
  return onSnapshot(
    query(collection(db, 'donorMatches'), where('donorId', '==', uid)),
    (snap) => callback(snap.docs.map(shape)),
    (error) => {
      console.error(error)
      onError(error)
    },
  )
}

export async function getMatch(matchId) {
  requireDb()
  const snap = await getDoc(doc(db, 'donorMatches', matchId))
  return snap.exists() ? shape(snap) : null
}

/** Responses and consent commit together through the authenticated donor service. */
export function respondToMatch(matchId, responseStatus, location = null, consent = {}) {
  return callDonorService('respond', { matchId, responseStatus, location, ...consent })
}

/** Every match for one request, for the hospital-side view (F6). */
export async function listMatchesForRequest(requestId) {
  requireDb()
  const snap = await getDocs(
    query(collection(db, 'donorMatches'), where('requestId', '==', requestId)),
  )
  return snap.docs.map(shape)
}
