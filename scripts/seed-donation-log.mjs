#!/usr/bin/env node
// Seeds a realistic donation log for ONE facility, so the Inventory page's
// "Donation log" tab has something to show:
//   - 5 blood requests (bloodRequests, schema §2.4)
//   - 14 pending donor matches (donorMatches, §2.5): 6 ready to confirm, plus
//     guidelines pending, not screened, deferred, rejected, declined, pending
//   - 3 already-confirmed donations (match + donations, §2.9)
//   - optionally (--with-stock) stock for any blood type with no inventory doc
//
// Runs with the Admin SDK, which bypasses the security rules — same writer as
// scripts/seed-reference-data.mjs. Needs donationTypes seeded first (npm run seed).
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     npm run seed:donations -- --hospital <hospitalId> [--with-stock]
//
//   ... npm run seed:donations -- --clean      removes everything this script made
//
// Every seeded request and match carries `seed: true`, which is how --clean
// finds them. Stock created by --with-stock is not tagged and is left alone.
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

const flag = (name) => process.argv.includes(name);
const option = (name) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : undefined;
};

const clean = flag('--clean');
const withStock = flag('--with-stock');
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = option('--project') || process.env.GCLOUD_PROJECT || 'dugo-plus';
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
  const resolvedKey = resolve(keyPath).toLowerCase();
  const repoRootFolded = repoRoot.toLowerCase();
  if (resolvedKey === repoRootFolded || resolvedKey.startsWith(repoRootFolded + sep)) {
    refuse(`the service-account key sits inside the repo (${resolvedKey}).\n  Move it outside the repository.`);
  }
}

const app = initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore(app);

// ---- --clean -------------------------------------------------------------
if (clean) {
  const [matches, requests] = await Promise.all([
    db.collection('donorMatches').where('seed', '==', true).get(),
    db.collection('bloodRequests').where('seed', '==', true).get(),
  ]);
  const batch = db.batch();
  matches.forEach((match) => {
    batch.delete(match.ref);
    batch.delete(db.doc(`donations/${match.id}`)); // a donation shares its match's ID
  });
  requests.forEach((request) => batch.delete(request.ref));
  await batch.commit();
  console.log(`Removed ${requests.size} requests, ${matches.size} matches and their donations.`);
  console.log('Stock counts and inventory logs are left as they are.');
  process.exit(0);
}

// ---- the facility --------------------------------------------------------
let hospitalId = option('--hospital');
if (!hospitalId) {
  const all = await db.collection('hospitals').get();
  if (all.size === 1) {
    hospitalId = all.docs[0].id;
  } else {
    const list = all.docs.map((d) => `    ${d.id}   ${d.data().name ?? ''}`).join('\n');
    refuse(`pass --hospital <id>. Facilities found:\n${list || '    (none)'}`);
  }
}
const hospitalSnap = await db.doc(`hospitals/${hospitalId}`).get();
if (!hospitalSnap.exists) refuse(`hospitals/${hospitalId} does not exist.`);
const hospital = hospitalSnap.data();

// ---- the data ------------------------------------------------------------
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const ago = (ms) => Timestamp.fromMillis(Date.now() - ms);

// Firebase-uid-looking donor IDs, stable between runs and distinct in their
// first eight characters (the table shows `xxxxxxxx…`).
const donor = (n) =>
  createHash('sha1').update(`dugo-seed-donor-${n}`).digest('base64url').slice(0, 20);

const STAFF = 'seed-staff';

const requests = [
  { key: 'a', bloodType: 'O+', component: 'whole-blood', quantity: 6, urgencyLevel: 'urgent', status: 'collecting', age: 20 * HOUR },
  { key: 'b', bloodType: 'A+', component: 'whole-blood', quantity: 4, urgencyLevel: 'routine', status: 'collecting', age: 2 * DAY },
  { key: 'c', bloodType: 'B-', component: 'platelets', quantity: 2, urgencyLevel: 'stat', status: 'urgent', age: 6 * HOUR },
  { key: 'd', bloodType: 'O-', component: 'plasma', quantity: 3, urgencyLevel: 'routine', status: 'collecting', age: 3 * DAY },
  { key: 'e', bloodType: 'AB+', component: 'whole-blood', quantity: 3, urgencyLevel: 'routine', status: 'matched', age: 9 * DAY },
];

// response / screening / ack describe how far each match got.
const matches = [
  // Ready to confirm — Accepted, Cleared, guidelines acknowledged.
  { req: 'a', n: 1, response: 'Accepted', screening: 'Cleared', ack: true, age: 18 * HOUR },
  { req: 'a', n: 2, response: 'Accepted', screening: 'Cleared', ack: true, age: 15 * HOUR },
  { req: 'a', n: 3, response: 'Accepted', screening: 'Cleared', ack: true, age: 11 * HOUR },
  { req: 'b', n: 4, response: 'Accepted', screening: 'Cleared', ack: true, age: 40 * HOUR },
  { req: 'b', n: 5, response: 'Accepted', screening: 'Cleared', ack: true, age: 30 * HOUR },
  { req: 'c', n: 6, response: 'Accepted', screening: 'Cleared', ack: true, age: 4 * HOUR },
  // Cleared, but the donor has not acknowledged the guidelines yet.
  { req: 'a', n: 7, response: 'Accepted', screening: 'Cleared', ack: false, age: 9 * HOUR },
  { req: 'b', n: 8, response: 'Accepted', screening: 'Cleared', ack: false, age: 26 * HOUR },
  // Not screened yet.
  { req: 'd', n: 9, response: 'Accepted', screening: null, ack: true, age: 50 * HOUR },
  { req: 'a', n: 10, response: 'Accepted', screening: null, ack: false, age: 7 * HOUR },
  // Screened out.
  { req: 'c', n: 11, response: 'Accepted', screening: 'Deferred', ack: true, age: 5 * HOUR },
  { req: 'd', n: 12, response: 'Accepted', screening: 'Rejected', ack: true, age: 60 * HOUR },
  // The donor never took it.
  { req: 'b', n: 13, response: 'Declined', screening: null, ack: false, age: 44 * HOUR },
  { req: 'd', n: 14, response: 'Pending', screening: null, ack: false, age: 3 * HOUR },
];

// Already confirmed: a match and its donation.
const confirmed = [
  { req: 'e', n: 15, units: 1, age: 8 * DAY },
  { req: 'e', n: 16, units: 1, age: 8 * DAY + 2 * HOUR },
  { req: 'e', n: 17, units: 1, age: 9 * DAY },
];

const typeOf = Object.fromEntries(requests.map((r) => [r.key, r]));
const requestId = (key) => `seed-req-${key}`;
const matchId = (key, n) => `${requestId(key)}_${donor(n)}`;

const STOCK = { 'O+': 14, 'O-': 6, 'A+': 11, 'A-': 4, 'B+': 9, 'B-': 2, 'AB+': 5, 'AB-': 1 };

// ---- write ---------------------------------------------------------------
const batch = db.batch();

for (const r of requests) {
  batch.set(db.doc(`bloodRequests/${requestId(r.key)}`), {
    recipientId: null,
    hospitalId,
    createdBy: STAFF,
    bloodType: r.bloodType,
    component: r.component,
    quantity: r.quantity,
    urgencyLevel: r.urgencyLevel,
    status: r.status,
    createdAt: ago(r.age),
    hospitalName: hospital.name ?? '',
    latitude: hospital.latitude ?? null,
    longitude: hospital.longitude ?? null,
    geohash: hospital.geohash ?? null,
    seed: true,
  });
}

for (const m of matches) {
  const request = typeOf[m.req];
  const matchedAt = ago(m.age);
  batch.set(db.doc(`donorMatches/${matchId(m.req, m.n)}`), {
    requestId: requestId(m.req),
    donorId: donor(m.n),
    donationTypeId: request.component,
    screenedByUserId: m.screening ? STAFF : null,
    responseStatus: m.response,
    screeningStatus: m.screening,
    guidelinesAcknowledged: m.ack,
    acknowledgedAt: m.ack ? ago(m.age - 20 * 60e3) : null,
    matchedAt,
    seed: true,
  });
}

for (const c of confirmed) {
  const request = typeOf[c.req];
  const id = matchId(c.req, c.n);
  batch.set(db.doc(`donorMatches/${id}`), {
    requestId: requestId(c.req),
    donorId: donor(c.n),
    donationTypeId: request.component,
    screenedByUserId: STAFF,
    responseStatus: 'Accepted',
    screeningStatus: 'Cleared',
    guidelinesAcknowledged: true,
    acknowledgedAt: ago(c.age + 3 * HOUR),
    matchedAt: ago(c.age + 6 * HOUR),
    seed: true,
  });
  batch.set(db.doc(`donations/${id}`), {
    matchId: id,
    hospitalId,
    donorId: donor(c.n),
    donorName: null,
    bloodType: request.bloodType,
    donationType: request.component,
    requestId: requestId(c.req),
    units: c.units,
    donationDate: ago(c.age),
    confirmedBy: STAFF,
    confirmedAt: ago(c.age),
  });
}

let stocked = 0;
if (withStock) {
  for (const [bloodType, units] of Object.entries(STOCK)) {
    const ref = db.doc(`hospitals/${hospitalId}/inventory/${bloodType}`);
    if ((await ref.get()).exists) continue;
    batch.set(ref, { bloodType, unitsAvailable: units, lastUpdated: ago(2 * HOUR) });
    stocked += 1;
  }
}

await batch.commit();

console.log(`Seeded ${hospital.name ?? hospitalId} (${hospitalId}):`);
console.log(`  ${requests.length} requests`);
console.log(`  ${matches.length} pending matches — 6 ready to confirm`);
console.log(`  ${confirmed.length} confirmed donations`);
if (withStock) console.log(`  ${stocked} stock rows created (existing rows kept)`);
console.log('Undo with: npm run seed:donations -- --clean');
