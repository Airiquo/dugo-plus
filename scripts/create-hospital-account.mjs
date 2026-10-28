#!/usr/bin/env node
// Creates a hospital account end to end (F3/F9): a Firebase Auth login (email
// verified, so it is not held at /verify-email, D6), a `hospitals/{id}` facility
// if one does not exist yet, and the `users/{uid}` profile with `role: 'hospital'`
// and the facility's `hospitalId`. Idempotent — a re-run finds what exists and
// re-applies it.
//
// Custom claims are NOT set here: they are published from `users/{uid}` by
// `scripts/set-claims.mjs` (the single claims path, D26). Run it after this:
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     npm run create:hospital -- --email hospital@dugo.ph --password 'YourPassw0rd'
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json npm run set:claims
//
// The key must live outside the repository and be deleted/revoked after use.
// Creating a login needs the service account's "Firebase Authentication Admin"
// role; the run stops with a clear error if that is missing.
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { geohash } from '../web/src/utils/geohash.js';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function refuse(message) {
  console.error(`create-hospital refused: ${message}`);
  process.exit(1);
}

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = arg('project', process.env.GCLOUD_PROJECT || 'dugo-plus');
const email = (arg('email') || process.env.HOSPITAL_EMAIL || '').trim();
const password = arg('password') || process.env.HOSPITAL_PASSWORD || '';
const name = arg('name', 'Tagaytay City Blood Bank');
const hospitalId = arg('hospital', 'tagaytay-blood-bank');
const address = arg('address', 'Tagaytay City, Cavite');
const latitude = Number(arg('latitude', '14.1153'));
const longitude = Number(arg('longitude', '120.9621'));
const contactNumber = arg('contact', '046 483 0000');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!email) refuse('pass --email <address> (or set HOSPITAL_EMAIL).');
if (!password) refuse('pass --password <secret> (or set HOSPITAL_PASSWORD).');
if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
  refuse('--latitude/--longitude must be numbers.');
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!emulator) {
  if (!keyPath) {
    refuse(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Create a service-account key for dugo-plus in the Firebase console,\n' +
        '  keep it outside the repo (e.g. ~/.config/dugo-plus/sa-key.json),\n' +
        '  then re-run with that variable set. Delete the key after use.',
    );
  }
  const resolvedKey = resolve(keyPath).toLowerCase();
  const repoRootFolded = repoRoot.toLowerCase();
  if (resolvedKey === repoRootFolded || resolvedKey.startsWith(repoRootFolded + sep)) {
    refuse(`the service-account key sits inside the repo (${resolvedKey}).`);
  }
}

const app = initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore(app);
const auth = getAuth(app);

// An admin is only needed as the facility's `createdBy`; look one up.
const admins = await db.collection('users').where('role', '==', 'admin').limit(1).get();
const adminUid = admins.empty ? null : admins.docs[0].id;

// Find or create the Auth user (email verified, D6).
let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password, emailVerified: true, displayName: name });
  console.log(`= auth user exists ${user.uid} (${email}); password/verified refreshed`);
} catch (error) {
  if (error?.code !== 'auth/user-not-found') {
    refuse(
      `Auth said "${error?.code || error?.message}". Creating a login needs the\n` +
        '  service account\'s "Firebase Authentication Admin" role — grant it in\n' +
        '  GCP IAM (as was done for roles/datastore.user), then re-run.',
    );
  }
  try {
    user = await auth.createUser({ email, password, emailVerified: true, displayName: name });
    console.log(`+ created auth user ${user.uid} (${email}, email verified)`);
  } catch (createError) {
    refuse(
      `could not create the Auth user: "${createError?.code || createError?.message}".\n` +
        '  If this is a permission error, grant the service account the\n' +
        '  "Firebase Authentication Admin" role in GCP IAM and re-run.',
    );
  }
}

const profileRef = db.doc(`users/${user.uid}`);
const profileSnap = await profileRef.get();
let facilityId = profileSnap.exists ? profileSnap.data()?.hospitalId || '' : '';
if (!facilityId) facilityId = hospitalId;

// Ensure the facility exists.
const facilityRef = db.doc(`hospitals/${facilityId}`);
const facilitySnap = await facilityRef.get();
if (facilitySnap.exists) {
  console.log(`= kept    hospitals/${facilityId} (exists; nothing overwritten)`);
} else {
  await facilityRef.set({
    createdBy: adminUid || null,
    name,
    address,
    latitude,
    longitude,
    geohash: geohash(latitude, longitude, 7),
    contactNumber,
    status: 'Active',
  });
  console.log(`+ created hospitals/${facilityId}`);
}

const data = {
  role: 'hospital',
  fullName: name,
  email,
  phoneNumber: '',
  status: 'Active',
  hospitalId: facilityId,
  updatedAt: FieldValue.serverTimestamp(),
};
if (!profileSnap.exists) data.createdAt = FieldValue.serverTimestamp();
await profileRef.set(data, { merge: true });
console.log(`${profileSnap.exists ? '~ set   ' : '+ create'} users/${user.uid} (role hospital → ${facilityId})`);

console.log(
  `\nDone. Sign in as ${email}. Facility hospitals/${facilityId}, project ` +
    `${project}${emulator ? ' (emulator)' : ''}.`,
);
console.log('Next: publish custom claims with `npm run set:claims` (same key), then refresh the session.');
process.exit(0);
