import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { geohash, isCoordinate } from '../utils/geohash'

/**
 * Facility documents — `hospitals/{hospitalId}` (schema §2.3).
 *
 * Hospital staff read their own facility through this module and update the
 * location/contact fields the rules allow. `status` and `createdBy` are not
 * writable here: status is an admin action and the creator is set at intake.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Same precision as a donor location: ~150 m, enough for a facility pin. */
const GEOHASH_PRECISION = 7

/** Firestore's local copy of the document; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Read a facility document.
 *
 * @param {string} hospitalId - the account's `users.hospitalId`
 * @returns {Promise<{
 *   id: string, name: string, address: string, latitude: number, longitude: number,
 *   geohash: string, contactNumber: string, status: string,
 * } | null>} null when the account has no facility or the document is missing.
 */
export async function readHospital(hospitalId) {
  requireDb()
  const id = text(hospitalId)
  if (!id) return null
  const snap = await getDoc(doc(db, 'hospitals', id))
  if (!snap.exists()) return null
  const data = snap.data() ?? {}
  return {
    id: snap.id,
    name: text(data.name),
    address: text(data.address),
    latitude: Number(data.latitude) || 0,
    longitude: Number(data.longitude) || 0,
    geohash: text(data.geohash),
    contactNumber: text(data.contactNumber),
    status: text(data.status),
  }
}

/**
 * Save the editable part of a facility profile (FR-013).
 *
 * Only the fields present in `changes` are written, so a rename does not
 * rewrite the coordinates. Sending a coordinate sends both values and the
 * recalculated geohash, which is what the radius matcher reads.
 *
 * @param {string} hospitalId
 * @param {{ name?: string, address?: string, contactNumber?: string,
 *           latitude?: number, longitude?: number }} changes
 */
export async function saveHospital(hospitalId, changes = {}) {
  requireDb()
  const id = text(hospitalId)
  if (!id) throw new Error('This account is not linked to a facility.')

  const data = {}
  if ('name' in changes) data.name = text(changes.name)
  if ('address' in changes) data.address = text(changes.address)
  if ('contactNumber' in changes) data.contactNumber = text(changes.contactNumber)

  if ('latitude' in changes || 'longitude' in changes) {
    const latitude = Number(changes.latitude)
    const longitude = Number(changes.longitude)
    if (!isCoordinate(latitude, longitude)) throw new Error('Enter a valid facility location.')
    data.latitude = latitude
    data.longitude = longitude
    data.geohash = geohash(latitude, longitude, GEOHASH_PRECISION)
  }

  if (!Object.keys(data).length) return
  await updateDoc(doc(db, 'hospitals', id), data)
}
