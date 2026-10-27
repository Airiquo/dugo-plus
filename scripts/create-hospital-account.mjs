#!/usr/bin/env node
// Creates the F3 hospital account: a Firebase Auth login (email verified, so it
// is not held at /verify-email, D6) plus its users/{uid} profile with
// role "hospital" and the facility's hospitalId. Idempotent: a re-run finds the
// existing Auth user and re-applies the profile.
//
// The facility must already exist — run `npm run seed` first (it writes
// hospitals/tagaytay-blood-bank).
//
// Runs with the Admin SDK, which bypasses the security rules (D15):
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     npm run create:hospital -- --email hospital@dugo.ph --password 'Passw0rd!'
//
// The key must live outside the repository and be deleted/revoked after use.
// Creating a login needs the service account's "Firebase Authentication Admin"
// role; if that is missing the run stops with a clear error.
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

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
const fullName = arg('name', 'Tagaytay City Blood Bank');
const hospitalId = arg('hospital', 'tagaytay-blood-bank');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!email) refuse('pass --email <address> (or set HOSPITAL_EMAIL).');
if (!password) refuse('pass --password <secret> (or set HOSPITAL_PASSWORD).');

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

const hospitalRef = db.doc(`hospitals/${hospitalId}`);
const hospitalSnap = await hospitalRef.get();
if (!hospitalSnap.exists) {
  refuse(`hospitals/${hospitalId} does not exist. Run "npm run seed" first.`);
}

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log(`= found   auth user ${user.uid} (${email})`);
} catch (error) {
  if (error?.code !== 'auth/user-not-found') {
    refuse(
      `Auth said "${error?.code || error?.message}". Creating a login needs the\n` +
        '  service account\'s "Firebase Authentication Admin" role — grant it in\n' +
        '  GCP IAM (as was done for roles/datastore.user), then re-run.',
    );
  }
  try {
    user = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: fullName,
    });
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
const data = {
  role: 'hospital',
  fullName,
  email,
  phoneNumber: '',
  status: 'Active',
  hospitalId,
};
if (!profileSnap.exists) data.createdAt = FieldValue.serverTimestamp();
await profileRef.set(data, { merge: true });
console.log(
  `${profileSnap.exists ? '~ set   ' : '+ create'} users/${user.uid} ` +
    `(role hospital → ${hospitalId})`,
);

console.log(
  `\nDone. Sign in as ${email}. Facility hospitals/${hospitalId}, project ` +
    `${project}${emulator ? ' (emulator)' : ''}.`,
);
process.exit(0);
