#!/usr/bin/env node
// Rewrites existing `users/{uid}` documents to the aligned shape (D22):
//   name        -> fullName
//   contact.phone -> phoneNumber
//   location.{coordinates,geohash,city,address} -> flat latitude/longitude/
//     geohash/city, with `address` dropped
//   + status ('Active' when absent) and hospitalId (only when already set)
//
// Dry by default: prints the planned change per document and writes nothing.
// Pass --apply to write. Idempotent — a document already in the new shape is
// reported as `= ok` and left alone, so a re-run after a partial failure is
// safe.
//
// Runs with the Admin SDK, which bypasses the security rules — the supported
// writer for a migration (D15). `users` is otherwise owner-written.
//
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     node scripts/backfill-users-shape.mjs [--apply] [--project <id>]
//
// The key must live outside this repository. Delete it once the backfill has
// run and the read-time fallbacks in services/users.js are removed (D22).
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const apply = process.argv.includes('--apply');
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = process.argv.includes('--project')
  ? process.argv[process.argv.indexOf('--project') + 1]
  : process.env.GCLOUD_PROJECT || 'dugo-plus';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
  console.error(`backfill refused: ${message}`);
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!emulator) {
  if (!keyPath) {
    refuse(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Create a service-account key for dugo-plus in the Firebase console,\n' +
        '  keep it outside the repo (e.g. ~/.config/dugo-plus/sa-key.json),\n' +
        '  then re-run with that variable set. Delete it after the backfill.',
    );
  }
  // Case-folded: macOS filesystems are case-insensitive, so a folded path
  // (shell $PWD vs the module's canonical URL) must not slip past.
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

const STATUSES = ['Active', 'Suspended', 'Removed'];
const ROLE_LABELS = ['donor', 'hospital', 'admin'];

/** A trimmed string, or null when the value is not a usable string. */
function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * The aligned document for an existing one, or null when it is already aligned.
 * Only fields the old shape carried are translated; `createdAt`,
 * `lastDonationAt`, `bloodType` and `dateOfBirth` pass through untouched.
 */
function aligned(data) {
  const oldLocation = data.location ?? null;
  const oldCoordinates = oldLocation?.coordinates ?? null;

  // New flat fields win when present, so a re-run over a partly migrated doc
  // does not undo it.
  const latitude = Number(data.latitude ?? oldCoordinates?.latitude ?? 0);
  const longitude = Number(data.longitude ?? oldCoordinates?.longitude ?? 0);
  const geohash = text(data.geohash) ?? text(oldLocation?.geohash) ?? '';
  const city = text(data.city) ?? text(oldLocation?.city) ?? '';

  const next = {
    fullName: text(data.fullName) ?? text(data.name) ?? '',
    phoneNumber: text(data.phoneNumber) ?? text(data.contact?.phone) ?? '',
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    geohash,
    city,
    status: STATUSES.includes(data.status) ? data.status : 'Active',
  };

  // Only carried over when the document already had one; a donor never does.
  const hospitalId = text(data.hospitalId);
  if (hospitalId) next.hospitalId = hospitalId;

  const changed =
    data.fullName !== next.fullName ||
    data.phoneNumber !== next.phoneNumber ||
    data.latitude !== next.latitude ||
    data.longitude !== next.longitude ||
    data.geohash !== next.geohash ||
    data.city !== next.city ||
    data.status !== next.status ||
    (hospitalId ?? null) !== (next.hospitalId ?? null) ||
    'name' in data ||
    'contact' in data ||
    'location' in data;

  if (!changed) return null;

  // Removes the old-shape fields rather than leaving them behind as duplicates,
  // which is what would let a stale reader see two sources of truth.
  return { next, remove: ['name', 'contact', 'location'] };
}

const snapshot = await db.collection('users').get();
console.log(
  `${apply ? 'Applying' : 'Dry run'} over ${snapshot.size} document(s) in ${project}.` +
    (apply ? '' : '  Pass --apply to write.'),
);

let migrated = 0;
let already = 0;

for (const doc of snapshot.docs) {
  const data = doc.data() ?? {};
  const plan = aligned(data);

  if (!plan) {
    already += 1;
    console.log(`= ok     users/${doc.id}`);
    continue;
  }

  const role = ROLE_LABELS.includes(data.role) ? data.role : `(role: ${data.role ?? 'absent'})`;
  console.log(
    `${apply ? '~ write' : '~ plan '} users/${doc.id}  [${role}]\n` +
      `         fullName: ${JSON.stringify(data.fullName ?? data.name ?? '')}\n` +
      `         phoneNumber: ${JSON.stringify(data.phoneNumber ?? data.contact?.phone ?? '')}\n` +
      `         flat lat/lng: ${plan.next.latitude}, ${plan.next.longitude}  city: ${JSON.stringify(plan.next.city)}\n` +
      `         status: ${plan.next.status}${plan.next.hospitalId ? `  hospitalId: ${plan.next.hospitalId}` : ''}`,
  );

  if (apply) {
    const removals = {};
    for (const field of plan.remove) removals[field] = FieldValue.delete();
    await doc.ref.set({ ...plan.next, ...removals }, { merge: true });
  }
  migrated += 1;
}

console.log(
  `\n${apply ? 'Migrated' : 'Would migrate'} ${migrated}; already aligned ${already}.` +
    (apply ? '' : '\nRe-run with --apply to write.'),
);
if (apply) {
  console.log(
    'Next: delete the read-time fallbacks in web/src/services/users.js, then\n' +
      'delete the service-account key and revoke it in the console (D22).',
  );
}
