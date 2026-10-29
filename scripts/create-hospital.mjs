#!/usr/bin/env node
// Create a hospital account without Cloud Functions (FR-040).
//
// The admin screen calls the `createHospitalAccount` callable, which needs the
// Blaze plan. Until that is enabled this Admin SDK script does the same work
// from a machine that holds a service-account key: Auth user, `users/{uid}`,
// `hospitals/{hospitalId}` and the `role: 'staff'` + `hospitalId` claims.
//
// Usage (key stays outside the repo):
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     npm run create:hospital -- \
//       --email partner@example.ph --password 'temp-password' \
//       --name 'Dr. Reyes' --facility 'St. Mary General' \
//       --address '1200 Bonifacio Ave' --contact '0917 000 0000' \
//       [--city 'Malolos'] [--lat 14.84] [--lng 120.81] [--id st-mary-general]
//
// The temporary password is printed once; send it over a verified channel and
// ask the hospital to change it from /forgot-password.

import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function refuse(message) {
  console.error(`create-hospital refused: ${message}`)
  process.exit(1)
}

function flag(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1]
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!keyPath) {
  refuse(
    'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
      '  Create a service-account key for the project in the Firebase console,\n' +
      '  keep it outside the repo (e.g. ~/.config/dugo-plus/sa-key.json),\n' +
      '  then re-run with that variable set.',
  )
}
const resolvedKey = resolve(keyPath).toLowerCase()
const repoRootFolded = repoRoot.toLowerCase()
if (resolvedKey === repoRootFolded || resolvedKey.startsWith(repoRootFolded + sep)) {
  refuse(`the service-account key sits inside the repo (${resolvedKey}).`)
}

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/** Geohash of a coordinate pair, or '' when one is missing (schema §2.2). */
function geohash(lat, lng, precision = 7) {
  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let hash = ''
  let bits = 0
  let bit = 0
  let even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2
      if (lng > mid) {
        bit = (bit << 1) | 1
        lngMin = mid
      } else {
        bit <<= 1
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat > mid) {
        bit = (bit << 1) | 1
        latMin = mid
      } else {
        bit <<= 1
        latMax = mid
      }
    }
    even = !even
    if (++bits === 5) {
      hash += BASE32[bit]
      bits = 0
      bit = 0
    }
  }
  return hash
}

const project = flag('project') || process.env.GCLOUD_PROJECT || 'dugo-plus'
const email = (flag('email') || '').trim().toLowerCase()
const password = flag('password') || ''
const fullName = (flag('name') || '').trim()
const facilityName = (flag('facility') || '').trim()
const address = (flag('address') || '').trim()
const contactNumber = (flag('contact') || '').trim()
const city = (flag('city') || '').trim()
const hasLat = flag('lat') !== null
const hasLng = flag('lng') !== null
const latitude = hasLat ? Number(flag('lat')) : 0
const longitude = hasLng ? Number(flag('lng')) : 0
const requestedId = (flag('id') || '').trim()

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) refuse('--email must be a valid address.')
if (password.length < 8) refuse('--password must be at least 8 characters.')
if (!fullName) refuse('--name is required (the contact person).')
if (!facilityName) refuse('--facility is required.')
if (!address) refuse('--address is required.')
if (!contactNumber) refuse('--contact is required.')
if (hasLat !== hasLng) refuse('give both --lat and --lng, or neither.')
if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) refuse('--lat and --lng must be numbers.')
if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
  refuse('the coordinates are out of range.')
}
const hash = geohash(latitude, longitude)

const hospitalId =
  requestedId ||
  `${facilityName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'hospital'}-${Math.random().toString(36).slice(2, 6)}`

const app = initializeApp({ credential: applicationDefault(), projectId: project })
const auth = getAuth(app)
const db = getFirestore(app)

const existingHospital = await db.doc(`hospitals/${hospitalId}`).get()
if (existingHospital.exists) refuse(`hospitals/${hospitalId} already exists.`)

let userRecord
try {
  userRecord = await auth.createUser({
    email,
    password,
    displayName: fullName,
    emailVerified: true,
  })
} catch (error) {
  refuse(
    error.code === 'auth/email-already-exists'
      ? `an account already uses ${email}.`
      : `Auth refused the account (${error.code || error.message}).`,
  )
}

try {
  const batch = db.batch()
  batch.set(db.doc(`users/${userRecord.uid}`), {
    role: 'hospital',
    fullName,
    email,
    phoneNumber: contactNumber,
    hospitalId,
    city,
    latitude,
    longitude,
    geohash: hash,
    status: 'Active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  batch.set(db.doc(`hospitals/${hospitalId}`), {
    name: facilityName,
    address,
    contactNumber,
    city,
    latitude,
    longitude,
    geohash: hash,
    status: 'Active',
    createdBy: 'script:create-hospital',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()
  await auth.setCustomUserClaims(userRecord.uid, { role: 'staff', hospitalId })
} catch (error) {
  await auth.deleteUser(userRecord.uid).catch(() => {})
  await db.doc(`users/${userRecord.uid}`).delete().catch(() => {})
  await db.doc(`hospitals/${hospitalId}`).delete().catch(() => {})
  refuse(`the records could not be written (${error.message}). Nothing was kept.`)
}

console.log(`+ hospital account created
  uid          ${userRecord.uid}
  email        ${email}
  facility     hospitals/${hospitalId}
  claims       role=staff hospitalId=${hospitalId}
  next         send the temporary password over a verified channel and ask for a reset`)
process.exit(0)
