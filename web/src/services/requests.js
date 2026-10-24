import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function maybeNum(value) {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * `bloodRequests/{id}` (schema §2.4). The recipient's city and coordinates are
 * denormalized onto the request at creation because a donor cannot read
 * `users/{recipientId}` (D27).
 */
export async function getBloodRequest(requestId) {
  requireDb()
  if (!requestId) return null
  const snap = await getDoc(doc(db, 'bloodRequests', requestId))
  if (!snap.exists()) return null
  const data = snap.data() ?? {}
  return {
    id: snap.id,
    recipientId: text(data.recipientId) || null,
    recipientCity: text(data.recipientCity),
    recipientLatitude: maybeNum(data.recipientLatitude),
    recipientLongitude: maybeNum(data.recipientLongitude),
    hospitalId: text(data.hospitalId),
    createdBy: text(data.createdBy) || null,
    bloodType: text(data.bloodType),
    component: text(data.component),
    quantity: num(data.quantity),
    urgencyLevel: text(data.urgencyLevel),
    status: text(data.status),
    createdAt: data.createdAt ?? null,
    hospitalName: text(data.hospitalName),
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    geohash: text(data.geohash),
  }
}
