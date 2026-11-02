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

/**
 * The facilities behind a set of IDs.
 *
 * A missing or unreadable document maps to `null` rather than failing the
 * caller: the history row still shows its date, component and points.
 *
 * @param {string[]} ids
 * @returns {Promise<Map<string, { id: string, name: string, address: string } | null>>}
 */
export async function readHospitals(ids) {
  requireDb()
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id))]
  const rows = await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'hospitals', id))
        if (!snap.exists()) return [id, null]
        const data = snap.data() ?? {}
        return [
          id,
          { id, name: text(data.name), address: text(data.address) },
        ]
      } catch {
        return [id, null]
      }
    }),
  )
  return new Map(rows)
}
