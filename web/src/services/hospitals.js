import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { geohash, isCoordinate } from '../utils/geohash'
import { BLOOD_TYPES } from './users'

/**
 * Facility documents — `hospitals/{hospitalId}` (schema §2.3) — plus the
 * facility's reads: stock (`hospitals/{hospitalId}/inventory`, §2.3.2) and
 * donation history (`donations`, §2.9), FR-020.
 *
 * Hospital staff read their own facility through this module and update the
 * location/contact fields the rules allow. `status` and `createdBy` are not
 * writable here: status is an admin action and the creator is set at intake.
 * Inventory writes are server-side callables (FR-034), never here.
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

/** A readable timestamp, or null for anything Firestore has not written yet. */
function asDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  return null
}

/** The eight blood types, in display order, missing documents as zero. */
function stockRows(snap) {
  const found = new Map()
  snap.forEach((item) => {
    const data = item.data() ?? {}
    const bloodType = BLOOD_TYPES.includes(data.bloodType) ? data.bloodType : item.id
    if (!BLOOD_TYPES.includes(bloodType)) return
    found.set(bloodType, {
      bloodType,
      unitsAvailable: Math.max(0, Math.trunc(Number(data.unitsAvailable) || 0)),
      lastUpdated: asDate(data.lastUpdated),
    })
  })
  return BLOOD_TYPES.map(
    (bloodType) => found.get(bloodType) ?? { bloodType, unitsAvailable: 0, lastUpdated: null },
  )
}

/** One `donations` document, shaped for a history row (FR-020). */
function donationRow(snap) {
  const data = snap.data() ?? {}
  return {
    id: snap.id,
    donorId: typeof data.donorId === 'string' ? data.donorId : '',
    donorName: typeof data.donorName === 'string' ? data.donorName : '',
    bloodType: typeof data.bloodType === 'string' ? data.bloodType : '',
    donationType: typeof data.donationType === 'string' ? data.donationType : '',
    requestId: typeof data.requestId === 'string' ? data.requestId : '',
    units: Math.trunc(Number(data.units) || 0),
    donationDate: asDate(data.donationDate),
  }
}

/**
 * Read the facility's stock once: one row per blood type, types without a
 * document reading as zero (FR-020).
 *
 * @param {string} hospitalId
 * @returns {Promise<Array<{bloodType: string, unitsAvailable: number, lastUpdated: Date|null}>>}
 */
export async function getInventory(hospitalId) {
  requireDb()
  const id = text(hospitalId)
  if (!id) return BLOOD_TYPES.map((bloodType) => ({ bloodType, unitsAvailable: 0, lastUpdated: null }))
  const snap = await getDocs(collection(db, 'hospitals', id, 'inventory'))
  return stockRows(snap)
}

/**
 * Follow the facility's stock with live updates (FR-020). Fires once with the
 * current rows, then on every change.
 *
 * @param {string} hospitalId
 * @param {(rows: Array<{bloodType: string, unitsAvailable: number, lastUpdated: Date|null}>) => void} onNext
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function watchInventory(hospitalId, onNext, onError) {
  requireDb()
  const id = text(hospitalId)
  if (!id) {
    onNext(BLOOD_TYPES.map((bloodType) => ({ bloodType, unitsAvailable: 0, lastUpdated: null })))
    return () => {}
  }
  return onSnapshot(
    collection(db, 'hospitals', id, 'inventory'),
    (snap) => onNext(stockRows(snap)),
    onError,
  )
}

/**
 * The facility's donation history, newest first (FR-020).
 *
 * @param {string} hospitalId
 * @param {{ cursor?: import('firebase/firestore').DocumentSnapshot | null, limit?: number }} [options]
 * @returns {Promise<{ rows: Array<ReturnType<typeof donationRow>>,
 *   cursor: import('firebase/firestore').DocumentSnapshot | null }>} `cursor` is
 *   null when the page returned fewer rows than asked for, i.e. the end.
 */
export async function getHospitalDonations(hospitalId, { cursor = null, limit: take = 50 } = {}) {
  requireDb()
  const id = text(hospitalId)
  if (!id) return { rows: [], cursor: null }

  const constraints = [where('hospitalId', '==', id), orderBy('donationDate', 'desc'), limit(take)]
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(collection(db, 'donations'), ...constraints))
  return {
    rows: snap.docs.map(donationRow),
    cursor: snap.docs.length === take ? snap.docs[snap.docs.length - 1] : null,
  }
}

/**
 * A donor's own donation history, newest first (FR-020).
 *
 * @param {string} donorId - the signed-in account's uid
 * @returns {Promise<Array<ReturnType<typeof donationRow>>>}
 */
export async function getDonorDonations(donorId) {
  requireDb()
  const id = text(donorId)
  if (!id) return []
  const snap = await getDocs(
    query(
      collection(db, 'donations'),
      where('donorId', '==', id),
      orderBy('donationDate', 'desc'),
    ),
  )
  return snap.docs.map(donationRow)
}
