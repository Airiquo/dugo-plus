#!/usr/bin/env node
// Seeds the reference data named in docs/firestore_schema.md §8:
//   - donationTypes (one per component, D13 intervals) + one guideline each
//   - systemConfig/global (retry settings + NFR-05 radius tiers, D18)
//
// Runs with the Admin SDK, which bypasses the security rules — the supported
// writer for these server-owned collections (D15). Existing docs are kept
// unless --force is passed.
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json npm run seed
//
// The key must live outside this repository (emulator runs may use a throwaway
// key), and an admin account must already
// exist (console-created; see AGENTS.md "Auth Rules") — systemConfig.updatedBy
// is attributed to it.
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { geohash } from '../web/src/utils/geohash.js';

const force = process.argv.includes('--force');
// Optional: link a hospital account to the seeded facility. Pass the account's
// email; its users/{uid}.hospitalId is set to the dev hospital. `users.hospitalId`
// is written but never read by a screen except the F3 hospital area.
const linkEmail = process.argv.includes('--link-email')
  ? process.argv[process.argv.indexOf('--link-email') + 1]
  : null;
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = process.argv.includes('--project')
  ? process.argv[process.argv.indexOf('--project') + 1]
  : process.env.GCLOUD_PROJECT || 'dugo-plus';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
  console.error(`seed refused: ${message}`);
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!emulator) {
  if (!keyPath) {
    refuse(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Create a service-account key for dugo-plus in the Firebase console,\n' +
        '  keep it outside the repo (e.g. ~/.config/dugo-plus/sa-key.json),\n' +
        '  then re-run with that variable set. Delete the key after seeding.',
    );
  }
  // Case-folded: macOS filesystems are case-insensitive, so a folded path
  // (shell $PWD vs the module's canonical URL) must not slip past.
  const resolvedKey = resolve(keyPath).toLowerCase();
  const repoRootFolded = repoRoot.toLowerCase();
  if (
    resolvedKey === repoRootFolded ||
    resolvedKey.startsWith(repoRootFolded + sep)
  ) {
    refuse(`the service-account key sits inside the repo (${resolvedKey}).\n` +
      '  Move it outside the repository; keys are never committed here.');
  }
}

// The Admin SDK needs credentials even against the emulator (its gRPC stub
// always builds an authenticated channel), so both modes read ADC via
// GOOGLE_APPLICATION_CREDENTIALS — emulator runs may use a throwaway key.
const app = initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore(app);

// An admin must already exist: console-created accounts are the only admins
// (AGENTS.md "Auth Rules"), and the seed attributes systemConfig to it.
const admins = await db.collection('users').where('role', '==', 'admin').limit(1).get();
if (admins.empty) {
  refuse(
    'no account in users/ has role "admin".\n' +
      '  Create one in the Firebase console, set its users/{uid}.role to "admin",\n' +
      '  then re-run this script.',
  );
}
const adminUid = admins.docs[0].id;

// Intervals are D13 (whole blood / platelets / plasma / double red cells);
// guideline copy is placeholder text the owner can edit in the console.
const donationTypes = [
  { id: 'whole-blood', name: 'Whole Blood', intervalDays: 56 },
  { id: 'platelets', name: 'Platelets', intervalDays: 7 },
  { id: 'plasma', name: 'Plasma', intervalDays: 28 },
  { id: 'double-red-cells', name: 'Double Red Cells', intervalDays: 112 },
];

// One dev facility so the F3 hospital area has a facility to post against
// (schema §2.3). Requests copy its name/coordinates, so the coordinates must be
// real for the matcher's radius search to mean anything.
const devHospital = {
  id: 'tagaytay-blood-bank',
  name: 'Tagaytay City Blood Bank',
  address: 'Tagaytay City, Cavite',
  latitude: 14.1153,
  longitude: 120.9621,
  contactNumber: '046 483 0000',
  status: 'Active',
};

// Radii follow NFR-05's 5→10→15→20–25 km ladder (D18); waitMinutes extends
// the schema §8 pattern (10/15/20…) and stays tunable via FR-041 later.
const systemConfig = {
  updatedBy: adminUid,
  notifRetryLimit: 3,
  notifRetryInterval: 5,
  radiusTiers: [
    { tierOrder: 1, radiusKm: 5, waitMinutes: 10 },
    { tierOrder: 2, radiusKm: 10, waitMinutes: 15 },
    { tierOrder: 3, radiusKm: 15, waitMinutes: 20 },
    { tierOrder: 4, radiusKm: 20, waitMinutes: 25 },
    { tierOrder: 5, radiusKm: 25, waitMinutes: 30 },
  ],
  updatedAt: FieldValue.serverTimestamp(),
};

let created = 0;
let overwritten = 0;
let kept = 0;

async function writeDoc(ref, data, label) {
  const existing = await ref.get();
  if (existing.exists && !force) {
    kept += 1;
    console.log(`= kept   ${label} (exists; --force overwrites)`);
    return;
  }
  await ref.set(data);
  const verb = existing.exists ? '~ set   ' : '+ create';
  if (existing.exists) {
    overwritten += 1;
  } else {
    created += 1;
  }
  console.log(`${verb} ${label}`);
}

for (const type of donationTypes) {
  await writeDoc(
    db.doc(`donationTypes/${type.id}`),
    { name: type.name, intervalDays: type.intervalDays },
    `donationTypes/${type.id}`,
  );
  await writeDoc(
    db.doc(`donationTypes/${type.id}/guidelines/interval`),
    {
      title: `Wait ${type.intervalDays} days between donations`,
      description:
        `${type.name} donations open again after ${type.intervalDays} days. ` +
        'The app checks this interval against your last donation date.',
    },
    `donationTypes/${type.id}/guidelines/interval`,
  );
}

await writeDoc(db.doc('systemConfig/global'), systemConfig, 'systemConfig/global');

await writeDoc(
  db.doc(`hospitals/${devHospital.id}`),
  {
    createdBy: adminUid,
    name: devHospital.name,
    address: devHospital.address,
    latitude: devHospital.latitude,
    longitude: devHospital.longitude,
    geohash: geohash(devHospital.latitude, devHospital.longitude, 7),
    contactNumber: devHospital.contactNumber,
    status: devHospital.status,
  },
  `hospitals/${devHospital.id}`,
);

if (linkEmail) {
  const matches = await db.collection('users').where('email', '==', linkEmail).limit(1).get();
  if (matches.empty) {
    refuse(`no users/ document has email "${linkEmail}".`);
  }
  await matches.docs[0].ref.set({ hospitalId: devHospital.id }, { merge: true });
  console.log(`~ linked users/${matches.docs[0].id} → hospitalId ${devHospital.id}`);
}

console.log(
  `\n${created} created, ${overwritten} overwritten, ${kept} kept` +
    `${force ? ' (--force)' : ''} — project ${project}${emulator ? ' (emulator)' : ''}`,
);
process.exit(0);
