/**
 * Blood requests (`bloodRequests`, schema §2.4).
 *
 * Hospital area — the list is scoped to one facility: `bloodRequests.hospitalId`
 * is stamped at creation from the account's `users.hospitalId`, and the
 * denormalized `hospitalName`/`latitude`/`longitude`/`geohash` are copied from
 * `hospitals/{id}` so the matcher's radius query needs no extra read. Routing a
 * request to donors is the matching Worker's job (`services/matching.js`).
 *
 * Donor area — `getBloodRequest` reads one request for the donor's map view. The
 * recipient's city and coordinates are denormalized onto the request at creation
 * because a donor cannot read `users/{recipientId}` (D27).
 *
 * Codes are the values the stylesheet targets (`data-status`, `data-priority`,
 * `data-blood-type`, `data-component`); labels are display text only.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { BLOOD_TYPES } from './users'
import { toDate } from '../utils/eligibility'
import { isComponent } from '../utils/matching'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Firestore's local copy of the request; throws when the app is unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** A finite number, or `fallback`. Used for the donor map read. */
function num(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** A finite number, or null when absent. Used for the donor map read. */
function maybeNum(value) {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** `.chip[data-status]` values, in the order the filters list them. */
export const REQUEST_STATUSES = ['urgent', 'collecting', 'matched', 'fulfilled', 'cancelled']

/** A request is still open until it is fulfilled or cancelled (FR-016). */
export const ACTIVE_STATUSES = ['urgent', 'collecting', 'matched']

/** `.chip[data-priority]` values. */
export const REQUEST_PRIORITIES = ['urgent', 'stat', 'routine']

/**
 * Blood components: `value` is the stored code (`data-component`), `label` is
 * the filter text and `short` is the table-cell text.
 */
export const COMPONENTS = [
  { value: 'whole-blood', label: 'Whole blood', short: 'Whole blood' },
  { value: 'rbc', label: 'Red cells (RBC)', short: 'Red cells' },
  { value: 'platelets', label: 'Platelets', short: 'Platelets' },
  { value: 'plasma', label: 'Plasma', short: 'Plasma' },
  { value: 'cryoprecipitate', label: 'Cryoprecipitate', short: 'Cryoprecipitate' },
]

/**
 * Display text for a component code.
 * @param {string} value - component code, e.g. 'rbc'
 * @param {'label'|'short'} [field] - 'label' (filters) or 'short' (table cells)
 */
export function componentLabel(value, field = 'short') {
  return COMPONENTS.find((c) => c.value === value)?.[field] ?? value
}

/**
 * Read a facility document (`hospitals/{id}`, schema §2.3).
 *
 * @param {string} hospitalId - the account's `users.hospitalId`
 * @returns {Promise<{id: string, name: string, address: string, latitude: number,
 *   longitude: number, geohash: string, contactNumber: string, status: string} | null>}
 *   null when the account has no facility or the document is missing.
 */
export async function fetchHospital(hospitalId) {
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

/** A `bloodRequests` document as the list screen's row shape. */
function requestFromDoc(snapshot) {
  const data = snapshot.data() ?? {}
  return {
    id: snapshot.id,
    hospitalId: text(data.hospitalId),
    recipientId: text(data.recipientId),
    createdBy: text(data.createdBy),
    bloodType: text(data.bloodType),
    component: text(data.component),
    quantity: Number(data.quantity) || 0,
    urgencyLevel: text(data.urgencyLevel),
    status: text(data.status),
    hospitalName: text(data.hospitalName),
    createdAt: toDate(data.createdAt),
  }
}

/**
 * A facility's requests, newest first, optionally narrowed to a status set.
 *
 * The status `in` filter plus the `createdAt` sort is served by the
 * `hospitalId + status + createdAt` composite index (schema §4).
 *
 * @param {string} hospitalId
 * @param {string[]} [statuses] - statuses to include; defaults to the active set
 * @returns {Promise<Array<object>>} rows from `requestFromDoc`
 */
export async function listHospitalRequests(hospitalId, statuses = ACTIVE_STATUSES) {
  requireDb()
  const id = text(hospitalId)
  if (!id) return []
  const wanted = statuses.filter(Boolean)
  const constraints = [where('hospitalId', '==', id)]
  if (wanted.length === 1) constraints.push(where('status', '==', wanted[0]))
  else if (wanted.length > 1) constraints.push(where('status', 'in', wanted))
  const q = query(collection(db, 'bloodRequests'), ...constraints, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(requestFromDoc)
}

/**
 * Post a request for a facility (FR-011, FR-017, FR-021 form half).
 *
 * The denormalized hospital fields come from the loaded `hospital`, so the
 * caller must have one; a request cannot be posted without a facility. The
 * returned id is what the caller hands to the matching Worker.
 *
 * @param {{
 *   hospital: {id: string, name: string, latitude: number, longitude: number, geohash: string},
 *   values: {bloodType: string, component: string, quantity: number|string, urgencyLevel: string},
 *   createdBy?: string|null,
 * }} input
 * @returns {Promise<string>} the new `bloodRequests` document id
 */
export async function createRequest({ hospital, values, createdBy = null }) {
  requireDb()
  if (!hospital?.id) throw new Error('This account is not linked to a facility.')

  const bloodType = text(values?.bloodType)
  const component = text(values?.component)
  const urgencyLevel = text(values?.urgencyLevel)
  const quantity = Number(values?.quantity)

  if (!BLOOD_TYPES.includes(bloodType)) throw new Error('Choose a blood type.')
  if (!isComponent(component)) throw new Error('Choose a component.')
  if (!REQUEST_PRIORITIES.includes(urgencyLevel)) throw new Error('Choose an urgency level.')
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Enter a quantity of at least 1 unit.')
  }

  const ref = await addDoc(collection(db, 'bloodRequests'), {
    hospitalId: hospital.id,
    recipientId: null,
    createdBy: createdBy ?? null,
    bloodType,
    component,
    quantity,
    urgencyLevel,
    // An urgent request is also urgent status (D24); everything else starts
    // collecting until the matcher and donors move it on.
    status: urgencyLevel === 'urgent' ? 'urgent' : 'collecting',
    hospitalName: hospital.name,
    latitude: hospital.latitude,
    longitude: hospital.longitude,
    geohash: hospital.geohash,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Move a request to a new status (FR-016, the hospital's "manage" half).
 *
 * Only the facility's staff may do this: `firestore.rules` requires the staff
 * custom claim (`role: 'staff'` + matching `hospitalId`, published by
 * `scripts/set-claims.mjs`, D26) and freezes `hospitalId`/`bloodType`. A caller
 * without the claim is denied by the rules, not by this function.
 *
 * @param {string} requestId
 * @param {'urgent'|'collecting'|'matched'|'fulfilled'|'cancelled'} status
 */
export async function updateRequestStatus(requestId, status) {
  requireDb()
  const id = text(requestId)
  if (!id) throw new Error('Missing request id.')
  if (!REQUEST_STATUSES.includes(status)) throw new Error(`Unknown request status: ${status}`)
  await updateDoc(doc(db, 'bloodRequests', id), { status })
}

/**
 * Read one request for the donor map view (F4).
 *
 * @param {string} requestId
 * @returns {Promise<object|null>}
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
