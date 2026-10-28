#!/usr/bin/env node
// Creates a hospital account: Firebase Auth user + users/{uid} + hospitals/{hospitalId} + custom claims.
// Idempotent — safe to run multiple times.
//
// Runs with the Admin SDK, which bypasses the security rules.
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/dugo-plus-firebase-adminsdk-fbsvc-c51dfae8f1.json \
//     GCLOUD_PROJECT=dugo-plus \
//     node scripts/create-hospital-user.mjs
//
// The key must live outside this repository.

import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = process.argv.includes('--project')
  ? process.argv[process.argv.indexOf('--project') + 1]
  : process.env.GCLOUD_PROJECT || 'dugo-plus';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HOSPITAL_EMAIL = 'hospital@test.com';
const HOSPITAL_PASSWORD = 'Hospital1234';
const HOSPITAL_NAME = 'Dugo Test Hospital';

function refuse(message) {
  console.error(`create-hospital-user refused: ${message}`);
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!emulator) {
  if (!keyPath) {
    refuse(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Set it to your service-account key path outside the repo.',
    );
  }
  const resolvedKey = resolve(keyPath).toLowerCase();
  const repoRootFolded = repoRoot.toLowerCase();
  if (resolvedKey === repoRootFolded || resolvedKey.startsWith(repoRootFolded + sep)) {
    refuse(
      `the service-account key sits inside the repo (${resolvedKey}).\n` +
        '  Move it outside the repository; keys are never committed here.',
    );
  }
}

const app = initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore(app);
const auth = getAuth(app);

// Ensure an admin exists (for createdBy)
const admins = await db.collection('users').where('role', '==', 'admin').limit(1).get();
if (admins.empty) {
  refuse('no account in users/ has role "admin". Create one first.');
}
const adminUid = admins.docs[0].id;
console.log(`Using admin: ${admins.docs[0].data().email || adminUid}`);

// Find or create Auth user
let userRecord;
try {
  userRecord = await auth.getUserByEmail(HOSPITAL_EMAIL);
  console.log(`= auth user exists: ${userRecord.uid}`);
  // Update to ensure password/emailVerified/displayName
  await auth.updateUser(userRecord.uid, {
    password: HOSPITAL_PASSWORD,
    emailVerified: true,
    displayName: HOSPITAL_NAME,
  });
  console.log(`~ updated auth user (password/emailVerified/displayName)`);
} catch (error) {
  if (error.code === 'auth/user-not-found') {
    userRecord = await auth.createUser({
      email: HOSPITAL_EMAIL,
      password: HOSPITAL_PASSWORD,
      emailVerified: true,
      displayName: HOSPITAL_NAME,
    });
    console.log(`+ created auth user: ${userRecord.uid}`);
  } else {
    throw error;
  }
}

const uid = userRecord.uid;

// Find existing hospital link or create one
const userSnap = await db.collection('users').doc(uid).get();
let hospitalId = userSnap.exists ? userSnap.data()?.hospitalId : null;

if (!hospitalId) {
  const hospitalRef = db.collection('hospitals').doc();
  await hospitalRef.set({
    createdBy: adminUid,
    name: HOSPITAL_NAME,
    address: '123 Test St, Test City',
    latitude: 14.5995,
    longitude: 120.9842,
    geohash: 'wdw4f7q',
    contactNumber: '+639000000000',
    status: 'Active',
  });
  hospitalId = hospitalRef.id;
  console.log(`+ created hospitals/${hospitalId}`);
} else {
  console.log(`= using existing hospitals/${hospitalId}`);
}

// Create/update user profile
await db.collection('users').doc(uid).set(
  {
    role: 'hospital',
    fullName: HOSPITAL_NAME,
    email: HOSPITAL_EMAIL,
    phoneNumber: '',
    hospitalId,
    status: 'Active',
    createdAt: userSnap.exists && userSnap.data()?.createdAt ? userSnap.data().createdAt : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);
console.log(`+ updated users/${uid} (role: hospital, hospitalId: ${hospitalId})`);

// Set custom claims
await auth.setCustomUserClaims(uid, { role: 'hospital', hospitalId });
console.log(`+ set custom claims { role: 'hospital', hospitalId: '${hospitalId}' }`);

console.log(`\nDone. Account: ${HOSPITAL_EMAIL} / ${HOSPITAL_PASSWORD}`);
console.log(`User: users/${uid}, Hospital: hospitals/${hospitalId}`);
process.exit(0);
