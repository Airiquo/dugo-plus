import { doc, getDoc, getDocs, collection, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { geohash } from '../utils/geohash'

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
 * `donorLocations/{uid}` — the coordinate mirror the hospital's nearby-donor
 * view reads (D31). Written by the donor when they save a profile that has
 * coordinates; `users/{uid}` itself stays owner+admin (NFR-11).
 */
export async function saveDonorLocation(uid, { latitude, longitude, city = '', bloodType = '' }) {
  requireDb()
  const lat = num(latitude)
  const lng = num(longitude)
  if (lat === null || lng === null) return false
  await setDoc(doc(db, 'donorLocations', uid), {
    donorId: uid,
    latitude: lat,
    longitude: lng,
    city: text(city),
    geohash: geohash(lat, lng),
    bloodType: text(bloodType),
    updatedAt: serverTimestamp(),
  })
  return true
}

export async function getDonorLocation(uid) {
  requireDb()
  const snap = await getDoc(doc(db, 'donorLocations', uid))
  if (!snap.exists()) return null
  const data = snap.data() ?? {}
  return {
    donorId: text(data.donorId) || snap.id,
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    city: text(data.city),
    geohash: text(data.geohash),
    bloodType: text(data.bloodType),
  }
}

/**
 * Donors near a coordinate, by geohash prefix. Readable by staff and admins
 * only (D31); the caller filters by blood type and exact distance.
 */
export async function listNearbyDonorLocations({ bloodType = '', prefix = '', max = 100 } = {}) {
  requireDb()
  const filters = []
  if (bloodType) filters.push(where('bloodType', '==', bloodType))
  if (prefix) filters.push(where('geohash', '>=', prefix), where('geohash', '<', `${prefix}z`))
  const snap = await getDocs(query(collection(db, 'donorLocations'), ...filters, limit(max)))
  return snap.docs.map((entry) => {
    const data = entry.data() ?? {}
    return {
      donorId: text(data.donorId) || entry.id,
      latitude: num(data.latitude),
      longitude: num(data.longitude),
      city: text(data.city),
      geohash: text(data.geohash),
      bloodType: text(data.bloodType),
    }
  })
}
