/**
 * Donor compatibility, deferral mapping, radius geometry, and request queue
 * ordering for the F7 matcher.
 *
 * Framework-free and pure so the React app, the matching Worker, and the tests
 * share one implementation. The compatibility matrix is component-aware: red
 * cells use the full red-cell matrix, plasma reverses ABO, platelets match ABO
 * only, and whole blood is exact ABO/Rh.
 */

import { toDate } from './eligibility.js'
import { geohash, geohashNeighbors, isCoordinate } from './geohash.js'

/** Every blood type, in display order. */
export const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

/** Request components, matching `services/requests.js` and schema §2.4. */
export const COMPONENTS = ['whole-blood', 'rbc', 'platelets', 'plasma', 'cryoprecipitate']

/** Urgency levels in queue order. */
export const URGENCY_LEVELS = ['urgent', 'stat', 'routine']

const URGENCY_RANK = { urgent: 0, stat: 1, routine: 2 }

/**
 * Red-cell compatibility: recipient type → donor types whose red cells the
 * recipient can receive. Rh is part of the match.
 */
const RBC_DONORS_FOR_RECIPIENT = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
}

/**
 * Plasma compatibility: recipient ABO → plasma donor ABOs the recipient can
 * receive. This is the reverse of the red-cell rule; Rh is not used.
 */
const PLASMA_ABO_DONORS_FOR_RECIPIENT = {
  O: ['O', 'A', 'B', 'AB'],
  A: ['A', 'AB'],
  B: ['B', 'AB'],
  AB: ['AB'],
}

/** Request component → the `donationTypes` row that supplies its interval. */
const COMPONENT_DONATION_TYPE = {
  'whole-blood': 'whole-blood',
  rbc: 'whole-blood',
  platelets: 'platelets',
  plasma: 'plasma',
  cryoprecipitate: 'plasma',
}

const ABO_VALUES = ['O', 'A', 'B', 'AB']

/** `A+` → `A`. Unknown values read as ''. */
export function aboOf(bloodType) {
  if (typeof bloodType !== 'string') return ''
  const abo = bloodType.replace(/[+-]$/, '')
  return ABO_VALUES.includes(abo) ? abo : ''
}

/** `A+` → `+`; `A-` → `-`. Unknown values read as ''. */
export function rhOf(bloodType) {
  if (typeof bloodType !== 'string') return ''
  if (bloodType.endsWith('+')) return '+'
  if (bloodType.endsWith('-')) return '-'
  return ''
}

/** True when the value is one of the eight stored blood types. */
export function isBloodType(value) {
  return BLOOD_TYPES.includes(value)
}

/** True when the value is one of the five stored request components. */
export function isComponent(value) {
  return COMPONENTS.includes(value)
}

/**
 * The donor blood types compatible with a recipient for a component.
 *
 * @param {string} recipientType - the patient's stored blood type
 * @param {string} component - `whole-blood | rbc | platelets | plasma | cryoprecipitate`
 * @returns {string[]} compatible donor types, or [] for unknown input
 */
export function compatibleDonorBloodTypes(recipientType, component) {
  if (!isBloodType(recipientType) || !isComponent(component)) return []

  if (component === 'whole-blood') return [recipientType]

  if (component === 'rbc') return [...RBC_DONORS_FOR_RECIPIENT[recipientType]]

  const abo = aboOf(recipientType)
  if (component === 'platelets') {
    return BLOOD_TYPES.filter((type) => aboOf(type) === abo)
  }

  const allowedAbo = PLASMA_ABO_DONORS_FOR_RECIPIENT[abo] ?? []
  return BLOOD_TYPES.filter((type) => allowedAbo.includes(aboOf(type)))
}

/**
 * True when a donor can give the requested component to the recipient.
 *
 * @param {string} recipientType
 * @param {string} donorType
 * @param {string} component
 */
export function isCompatibleDonor(recipientType, donorType, component) {
  return compatibleDonorBloodTypes(recipientType, component).includes(donorType)
}

/**
 * The `donationTypes/{id}` row that supplies the deferral interval for a
 * requested component, or null for an unknown component.
 *
 * `rbc` maps to whole blood, and `cryoprecipitate` maps to plasma: the request
 * names the component, while the donor's interval belongs to the procedure that
 * produces it.
 */
export function donationTypeForComponent(component) {
  return COMPONENT_DONATION_TYPE[component] ?? null
}

/** Numeric rank for queue sorting; unknown urgency sorts last. */
export function urgencyRank(level) {
  return URGENCY_RANK[level] ?? URGENCY_LEVELS.length
}

/**
 * Sort requests for matching: highest urgency first, then oldest first.
 * Returns a new array; the input is not mutated.
 *
 * @param {Array<{urgencyLevel?: string, createdAt?: unknown}>} requests
 * @returns {Array} the same request objects, sorted
 */
export function sortRequestsByUrgency(requests) {
  return [...requests].sort((a, b) => {
    const rank = urgencyRank(a.urgencyLevel) - urgencyRank(b.urgencyLevel)
    if (rank !== 0) return rank
    const aTime = toDate(a.createdAt)?.getTime() ?? 0
    const bTime = toDate(b.createdAt)?.getTime() ?? 0
    return aTime - bTime
  })
}

/** Great-circle distance in kilometres, or null for unusable coordinates. */
export function distanceKm(a, b) {
  if (!a || !b || !isCoordinate(a.lat, a.lng) || !isCoordinate(b.lat, b.lng)) return null
  const radius = 6371.0088
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Geohash prefixes that cover a radius search, with the precision chosen so a
 * 3×3 cell block is at least as wide as the radius.
 *
 * The result is a query hint, not the filter: callers must still discard donors
 * whose exact distance is greater than the radius.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 * @returns {string[]} unique geohash prefixes
 */
export function geohashPrefixesForRadius(lat, lng, radiusKm) {
  if (!isCoordinate(lat, lng) || !Number.isFinite(radiusKm) || radiusKm <= 0) return []
  const precision = radiusKm <= 10 ? 5 : 4
  const center = geohash(lat, lng, precision)
  if (!center) return []
  return geohashNeighbors(center)
}
