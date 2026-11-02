#!/usr/bin/env node
// Seeds the demo world the donor screens read (F5 now; F3, F4 and F6 later):
// one hospital, three fulfilled requests with their matches, three donations
// with their reward transactions, and the inventory rows and logs a confirmed
// donation leaves behind (schema §2.3–§2.5, §2.9, §2.10; points per D12,
// intervals per D13).
//
// These are the writes no client may make — matches are matcher-only, donations
// are staff-only, rewardTransactions is server-only, and users.lastDonationAt is
// frozen for its owner (D12, D14). The Admin SDK bypasses all four, which is why
// a fixture is the only way to exercise the screens before F8's transaction
// exists. Delete the `demo-` documents once F8 writes real ones.
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     npm run seed:demo -- --donor-email you@example.com --allow-live
//
// or against the emulator, with no key:
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:demo -- --donor-email ...
//
// Every document this script writes is prefixed `demo-`; a live project is
// refused unless --allow-live is passed.
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { geohash } from '../web/src/utils/geohash.js';

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
/** `--name=value` or `--name value`; undefined when absent. */
function flag(name) {
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1];
  }
  return undefined;
}

function refuse(message) {
  console.error(`seed:demo refused: ${message}`);
  process.exit(1);
}

const force = has('force');
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = flag('project') || process.env.GCLOUD_PROJECT || 'dugo-plus';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!emulator && !has('allow-live')) {
  refuse(
    'this fixture writes demo hospitals, requests, matches and donations.\n' +
      '  Pass --allow-live to write it into the ' + project + ' project, or set\n' +
      '  FIRESTORE_EMULATOR_HOST to seed the emulator instead.',
  );
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!emulator) {
  if (!keyPath) {
    refuse(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Create a service-account key for ' + project + ' in the Firebase console,\n' +
        '  keep it outside the repo (e.g. ~/.config/dugo-plus/sa-key.json),\n' +
        '  then re-run with that variable set.',
    );
  }
  // Case-folded: macOS is case-insensitive, so a folded path must not slip past.
  const resolvedKey = resolve(keyPath).toLowerCase();
  const repoRootFolded = repoRoot.toLowerCase();
  if (resolvedKey === repoRootFolded || resolvedKey.startsWith(repoRootFolded + sep)) {
    refuse(
      `the service-account key sits inside the repo (${resolvedKey}).\n` +
        '  Move it outside the repository; keys are never committed here.',
    );
  }
}

// The Admin SDK needs credentials even against the emulator (its gRPC stub
// always builds an authenticated channel), so both modes read ADC.
const app = initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore(app);
const auth = getAuth(app);

// ---------------------------------------------------------------- donor ----

let donorUid = flag('donor-uid');
const donorEmail = flag('donor-email');
if (!donorUid && !donorEmail) {
  refuse(
    'pass --donor-email=<email> (or --donor-uid=<uid>).\n' +
      '  The fixture has to attach to an account you can sign in as.',
  );
}
if (!donorUid) {
  try {
    donorUid = (await auth.getUserByEmail(donorEmail)).uid;
  } catch {
    if (!has('create-donor')) {
      refuse(
        `no Auth account for ${donorEmail}.\n` +
          '  Register it in the app first, or pass --create-donor --donor-password=<8+ chars>',
      );
    }
    const password = flag('donor-password');
    if (!password || password.length < 8) {
      refuse('--create-donor needs --donor-password=<8+ characters>.');
    }
    const created = await auth.createUser({
      email: donorEmail,
      password,
      emailVerified: true,
      displayName: 'Demo Donor',
    });
    donorUid = created.uid;
    console.log(`+ auth   ${donorEmail} (uid ${donorUid})`);
  }
}

// ---------------------------------------------------------- staff + donor ----

const admins = await db.collection('users').where('role', '==', 'admin').limit(1).get();
if (admins.empty) {
  refuse(
    'no account in users/ has role "admin".\n' +
      '  Run scripts/seed-reference-data.mjs, or set a console account to role "admin",\n' +
      '  then re-run. The fixture attributes its staff fields to that account.',
  );
}
const staffUid = admins.docs[0].id;

const donorRef = db.doc(`users/${donorUid}`);
const donorSnap = await donorRef.get();
const donor = donorSnap.exists ? donorSnap.data() : {};
const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const bloodType = BLOOD_TYPES.includes(donor.bloodType) ? donor.bloodType : 'O+';

if (!donorSnap.exists) {
  console.log(`! note   users/${donorUid} has no document yet; the fixture writes anyway.`);
}
if (!donor.dateOfBirth) {
  console.log(
    `! note   users/${donorUid}.dateOfBirth is empty — the tracker will say "Not enough information".\n` +
      '         Set the date of birth on /donor/profile, then re-run.',
  );
}

// ------------------------------------------------------------- the world ----

const HOSPITAL_ID = 'demo-hospital-01';
const HOSPITAL_NAME = 'Demo District Hospital';
const HOSPITAL_ADDRESS = 'Malolos, Bulacan';
const LATITUDE = 14.8443;
const LONGITUDE = 120.8114;
const HASH = geohash(LATITUDE, LONGITUDE, 7);

// D12's points per component; whole blood and platelets are per donation,
// plasma is per unit.
const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const DONATIONS = [
  { key: '01', type: 'platelets', typeName: 'Platelets', daysAgo: 3, units: 1, points: 150 },
  { key: '02', type: 'whole-blood', typeName: 'Whole Blood', daysAgo: 40, units: 1, points: 100 },
  { key: '03', type: 'plasma', typeName: 'Plasma', daysAgo: 100, units: 2, points: 60 },
];

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

await writeDoc(
  db.doc(`hospitals/${HOSPITAL_ID}`),
  {
    createdBy: staffUid,
    name: HOSPITAL_NAME,
    address: HOSPITAL_ADDRESS,
    latitude: LATITUDE,
    longitude: LONGITUDE,
    geohash: HASH,
    contactNumber: '+63 900 000 0000',
    status: 'Active',
  },
  `hospitals/${HOSPITAL_ID}`,
);

let units = 0;

for (const item of DONATIONS) {
  const requestId = `demo-request-${item.key}`;
  const matchId = `${requestId}_${donorUid}`;
  const donatedAt = new Date(now.getTime() - item.daysAgo * DAY_MS);
  const requestedAt = new Date(donatedAt.getTime() - 2 * DAY_MS);
  const matchedAt = new Date(requestedAt.getTime() + 60 * 60 * 1000);
  units += item.units;

  await writeDoc(
    db.doc(`bloodRequests/${requestId}`),
    {
      recipientId: null,
      hospitalId: HOSPITAL_ID,
      createdBy: staffUid,
      bloodType,
      component: item.type,
      quantity: Math.max(1, item.units),
      urgencyLevel: 'routine',
      status: 'fulfilled',
      createdAt: Timestamp.fromDate(requestedAt),
      hospitalName: HOSPITAL_NAME,
      latitude: LATITUDE,
      longitude: LONGITUDE,
      geohash: HASH,
    },
    `bloodRequests/${requestId}`,
  );

  await writeDoc(
    db.doc(`donorMatches/${matchId}`),
    {
      requestId,
      donorId: donorUid,
      donationTypeId: item.type,
      screenedByUserId: staffUid,
      responseStatus: 'Accepted',
      screeningStatus: 'Cleared',
      guidelinesAcknowledged: true,
      acknowledgedAt: Timestamp.fromDate(matchedAt),
      matchedAt: Timestamp.fromDate(matchedAt),
    },
    `donorMatches/${matchId}`,
  );

  await writeDoc(
    db.doc(`donations/${matchId}`),
    {
      matchId,
      confirmedBy: staffUid,
      donationDate: Timestamp.fromDate(donatedAt),
      units: item.units,
      confirmedAt: Timestamp.fromDate(donatedAt),
      donorId: donorUid,
      hospitalId: HOSPITAL_ID,
      bloodType,
    },
    `donations/${matchId}`,
  );

  await writeDoc(
    db.doc(`rewardTransactions/${matchId}`),
    {
      donorId: donorUid,
      donationId: matchId,
      points: item.points,
      awardedAt: Timestamp.fromDate(donatedAt),
    },
    `rewardTransactions/${matchId} (${item.points} pts)`,
  );

  await writeDoc(
    db.doc(`hospitals/${HOSPITAL_ID}/inventory/${bloodType}/logs/${matchId}`),
    {
      donationId: matchId,
      userId: staffUid,
      changeType: 'Donation',
      unitsChanged: item.units,
      createdAt: Timestamp.fromDate(donatedAt),
    },
    `hospitals/${HOSPITAL_ID}/inventory/${bloodType}/logs/${matchId}`,
  );
}

await writeDoc(
  db.doc(`hospitals/${HOSPITAL_ID}/inventory/${bloodType}`),
  {
    bloodType,
    unitsAvailable: units,
    lastUpdated: FieldValue.serverTimestamp(),
  },
  `hospitals/${HOSPITAL_ID}/inventory/${bloodType} (${units} units)`,
);

// The newest donation is what a deferral counts from (D13); D14 freezes the
// field for its owner, so only this Admin SDK path (or F8's transaction) writes it.
const newest = new Date(now.getTime() - DONATIONS[0].daysAgo * DAY_MS);
await donorRef.set({ lastDonationAt: Timestamp.fromDate(newest) }, { merge: true });
console.log(`~ set    users/${donorUid}.lastDonationAt (${newest.toISOString()})`);

const points = DONATIONS.reduce((sum, item) => sum + item.points, 0);
console.log(
  `\n${created} created, ${overwritten} overwritten, ${kept} kept` +
    `${force ? ' (--force)' : ''} — project ${project}${emulator ? ' (emulator)' : ''}\n` +
    `donor ${donorEmail ?? donorUid}: ${DONATIONS.length} donations, ${points} points, ` +
    `${units} units of ${bloodType} at ${HOSPITAL_NAME}`,
);
process.exit(0);
