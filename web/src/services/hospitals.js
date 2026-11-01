import { doc, getDoc } from 'firebase/firestore'
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

/**
 * `hospitals/{id}` — read for the map popup's address and contact number
 * (FR-023). Signed-in reads are already allowed by the rules.
 */
export async function getHospital(hospitalId) {
  requireDb()
  if (!hospitalId) return null
  const snap = await getDoc(doc(db, 'hospitals', hospitalId))
  if (!snap.exists()) return null
  const data = snap.data() ?? {}
  return {
    id: snap.id,
    name: text(data.name),
    address: text(data.address),
    contactNumber: text(data.contactNumber),
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    geohash: text(data.geohash),
    status: text(data.status),
  }
}
