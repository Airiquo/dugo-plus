// Firestore security-rules suite, run against the emulator:
//   npm run test:rules
// Covers the 15 collections in docs/firestore_schema.md §6 plus errorLogs:
// owner/claim boundaries, the users lastDonationAt freeze (D14), the
// server-only write paths (D15), and the open-create error log (D17).
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

const env = await initializeTestEnvironment({
  projectId: process.env.GCLOUD_PROJECT ?? 'demo-dugo',
  firestore: {
    rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
    host,
    port: Number(port),
  },
});

let passed = 0;
let failed = 0;

const ok = async (name, promise) => {
  try {
    await assertSucceeds(promise);
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name} — expected allow, got: ${error.message}`);
  }
};

const no = async (name, promise) => {
  try {
    await assertFails(promise);
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name} — expected deny, got: ${error.message}`);
  }
};

const db = (ctx) => ctx.firestore();
const as = (uid, claims) => env.authenticatedContext(uid, claims);
const anon = () => env.unauthenticatedContext();
const admin = () => env.authenticatedContext('admin1', { role: 'admin' });
const staff1 = () => env.authenticatedContext('staff1', { role: 'staff', hospitalId: 'h1' });
const staff2 = () => env.authenticatedContext('staff2', { role: 'staff', hospitalId: 'h2' });
const readDoc = (ctx, path) => getDoc(doc(db(ctx), path));

// ---- fixtures ------------------------------------------------------------
await env.withSecurityRulesDisabled(async (ctx) => {
  const f = db(ctx);
  await setDoc(doc(f, 'users/alice'), { role: 'donor', fullName: 'Alice D.', email: 'alice@dugo.ph', phoneNumber: '09170000000', city: 'Malolos', geohash: 'wdt4', latitude: 14.84, longitude: 120.81, status: 'Active', createdAt: new Date() });
  await setDoc(doc(f, 'users/bob'), { role: 'donor', fullName: 'Bob B.', email: 'bob@dugo.ph', createdAt: new Date() });
  await setDoc(doc(f, 'users/dave'), { role: 'donor', fullName: 'Dave D.', email: 'dave@dugo.ph', createdAt: new Date(), lastDonationAt: new Date('2026-10-01') });
  // `erin` exercises the suspension gate (D26); `admin1` gives the admin claim
  // a profile of its own so the self-update path is covered.
  await setDoc(doc(f, 'users/erin'), { role: 'donor', fullName: 'Erin E.', email: 'erin@dugo.ph', status: 'Active', createdAt: new Date() });
  await setDoc(doc(f, 'users/admin1'), { role: 'admin', fullName: 'Admin One', email: 'admin@dugo.ph', status: 'Active', createdAt: new Date() });
  await setDoc(doc(f, 'hospitals/h1'), { createdBy: 'admin1', name: 'St. Mary General', address: '1200 Bonifacio Ave', latitude: 14.609, longitude: 120.984, geohash: 'qc7bw', contactNumber: '09170000000', status: 'Active' });
  await setDoc(doc(f, 'hospitals/h1/subscriptions/s1'), { plan: 'pilot', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), status: 'Active' });
  await setDoc(doc(f, 'hospitals/h1/inventory/O+'), { bloodType: 'O+', unitsAvailable: 3, lastUpdated: new Date() });
  await setDoc(doc(f, 'bloodRequests/r1'), { hospitalId: 'h1', hospitalName: 'St. Mary General', recipientId: null, createdBy: 'alice', bloodType: 'O+', component: 'whole-blood', quantity: 2, urgencyLevel: 'urgent', status: 'collecting', createdAt: new Date(), latitude: 14.609, longitude: 120.984, geohash: 'qc7bw' });
  await setDoc(doc(f, 'donorMatches/r1_alice'), { requestId: 'r1', donorId: 'alice', donationTypeId: 'whole-blood', screenedByUserId: null, responseStatus: 'Pending', screeningStatus: null, guidelinesAcknowledged: false, acknowledgedAt: null, matchedAt: new Date() });
  await setDoc(doc(f, 'donorConsents/c1'), { donorId: 'alice', matchId: 'r1_alice', consentType: 'ProfileAccess', grantedAt: new Date(), revokedAt: null });
  await setDoc(doc(f, 'donorLocations/alice'), { donorId: 'alice', latitude: 14.84, longitude: 120.81, city: 'Malolos', geohash: 'wdt4', bloodType: 'O+', updatedAt: new Date() });
  await setDoc(doc(f, 'donationTypes/whole-blood'), { name: 'Whole Blood', intervalDays: 56 });
  await setDoc(doc(f, 'donationTypes/whole-blood/guidelines/g1'), { title: 'Wait the full interval', description: 'Whole blood may be donated every 56 days.' });
  await setDoc(doc(f, 'notifications/n1'), { userId: 'alice', requestId: 'r1', channel: 'Email', deliveryStatus: 'Pending', retryCount: 0, sentAt: null });
  await setDoc(doc(f, 'donations/r1_alice'), { matchId: 'r1_alice', confirmedBy: 'staff1', donationDate: new Date(), units: 1, confirmedAt: new Date(), donorId: 'alice', hospitalId: 'h1', bloodType: 'O+' });
  await setDoc(doc(f, 'rewardTransactions/r1_alice'), { donorId: 'alice', donationId: 'r1_alice', points: 100, awardedAt: new Date() });
  await setDoc(doc(f, 'systemConfig/global'), { updatedBy: 'admin1', notifRetryLimit: 3, notifRetryInterval: 5, radiusTiers: [{ tierOrder: 1, radiusKm: 5, waitMinutes: 10 }], updatedAt: new Date() });
  await setDoc(doc(f, 'dataSubjectRequests/dsr1'), { userId: 'alice', processedBy: null, requestType: 'Access', status: 'Pending', createdAt: new Date(), resolvedAt: null });
  await setDoc(doc(f, 'auditBlocks/b1'), { prevHash: '0', recordHash: 'abc123', eventType: 'UserCreated', hashedEntityRef: 'h', hashedActorRef: 'a', createdAt: new Date(), sequence: 1 });
  await setDoc(doc(f, 'errorLogs/e1'), { message: 'boom', stack: 'stack', route: '/', uid: '', build: 'web-1', createdAt: serverTimestamp() });
});

// ---- users (D14 freeze, D15 claims, D16 shipped shape) -------------------
console.log('users');
await ok('owner reads own profile', readDoc(as('alice'), 'users/alice'));
await no('another donor cannot read a profile', readDoc(as('bob'), 'users/alice'));
await no('signed-out cannot read a profile', readDoc(anon(), 'users/alice'));
await ok('admin claim reads any profile', readDoc(admin(), 'users/alice'));
await ok('admin claim reads its own profile', readDoc(admin(), 'users/admin1'));
await ok('owner creates own profile', setDoc(doc(db(as('carol')), 'users/carol'), { role: 'donor', fullName: 'Carol C.', email: 'carol@dugo.ph', createdAt: new Date() }));
await no('self-create cannot claim admin (D20/D29)', setDoc(doc(db(as('dan')), 'users/dan'), { role: 'admin', fullName: 'Dan D.', email: 'dan@dugo.ph', createdAt: new Date() }));
await no('self-create cannot claim hospital (D20/D29)', setDoc(doc(db(as('hana')), 'users/hana'), { role: 'hospital', fullName: 'Hana H.', email: 'hana@dugo.ph', createdAt: new Date() }));
await ok('admin claim creates a hospital profile (D26)', setDoc(doc(db(admin()), 'users/hosp1'), { role: 'hospital', fullName: 'St. Mary', email: 'staff@dugo.ph', createdAt: new Date() }));
await no('create cannot set lastDonationAt (D14)', setDoc(doc(db(as('eve')), 'users/eve'), { role: 'donor', fullName: 'Eve E.', email: 'eve@dugo.ph', createdAt: new Date(), lastDonationAt: new Date() }));
await no('signed-out cannot create a profile', setDoc(doc(db(anon()), 'users/frank'), { role: 'donor', fullName: 'Frank F.', email: 'frank@dugo.ph', createdAt: new Date() }));
await no('create cannot invent a status', setDoc(doc(db(as('gina')), 'users/gina'), { role: 'donor', fullName: 'Gina G.', email: 'gina@dugo.ph', status: 'Admin', createdAt: new Date() }));
await ok('owner edits profile fields', updateDoc(doc(db(as('alice')), 'users/alice'), { fullName: 'Alice D.', phoneNumber: '09170000001', city: 'Malolos', latitude: 14.85, longitude: 120.82, geohash: 'wdt5' }));
await no('owner cannot change role', updateDoc(doc(db(as('alice')), 'users/alice'), { role: 'admin' }));
await no('owner cannot suspend themselves (status is an admin decision)', updateDoc(doc(db(as('alice')), 'users/alice'), { status: 'Suspended' }));
await no('owner cannot set hospitalId', updateDoc(doc(db(as('alice')), 'users/alice'), { hospitalId: 'h1' }));
await no('owner cannot set lastDonationAt (presence)', updateDoc(doc(db(as('alice')), 'users/alice'), { lastDonationAt: new Date() }));
await no('owner cannot clear lastDonationAt (value)', updateDoc(doc(db(as('dave')), 'users/dave'), { lastDonationAt: null }));
await ok('owner edit leaves lastDonationAt untouched', updateDoc(doc(db(as('dave')), 'users/dave'), { fullName: 'Dave D.' }));
await no('owner cannot delete profile', deleteDoc(doc(db(as('alice')), 'users/alice')));
await ok('admin claim updates any profile', updateDoc(doc(db(admin()), 'users/alice'), { fullName: 'Alice D.' }));
await ok('admin claim updates its own profile (same-doc read)', updateDoc(doc(db(admin()), 'users/admin1'), { fullName: 'Admin One' }));
await ok('admin claim suspends a profile (FR-040)', updateDoc(doc(db(admin()), 'users/alice'), { status: 'Suspended' }));

// ---- suspension gate (D26) ----------------------------------------------
// A suspended account keeps its own profile read (the blocked screen names the
// state) but loses every other authenticated path until an admin restores it.
console.log('suspension (D26)');
await ok('active account reads reference data', readDoc(as('erin'), 'donationTypes/whole-blood'));
await ok('admin claim suspends the account', updateDoc(doc(db(admin()), 'users/erin'), { status: 'Suspended' }));
await ok('suspended account still reads its own profile', readDoc(as('erin'), 'users/erin'));
await no('suspended account cannot read reference data', readDoc(as('erin'), 'donationTypes/whole-blood'));
await no('suspended account cannot read hospitals', readDoc(as('erin'), 'hospitals/h1'));
await no('suspended account cannot edit its own profile', updateDoc(doc(db(as('erin')), 'users/erin'), { fullName: 'Erin E.' }));
await no('suspended account cannot open a data request', setDoc(doc(db(as('erin')), 'dataSubjectRequests/dsr4'), { userId: 'erin', processedBy: null, requestType: 'Access', status: 'Pending', createdAt: serverTimestamp(), resolvedAt: null }));
await ok('admin claim restores the account', updateDoc(doc(db(admin()), 'users/erin'), { status: 'Active' }));
await ok('restored account reads reference data again', readDoc(as('erin'), 'donationTypes/whole-blood'));
// Put alice back so the rest of the suite exercises an active session.
await ok('admin claim reactivates a profile', updateDoc(doc(db(admin()), 'users/alice'), { status: 'Active' }));

// ---- errorLogs (D17) -----------------------------------------------------
console.log('errorLogs');
await ok('signed-out can create an error report', setDoc(doc(db(anon()), 'errorLogs/e2'), { message: 'boom', stack: 'stack', route: '/', uid: '', build: 'web-1', createdAt: serverTimestamp() }));
await no('error report shape is bounded', setDoc(doc(db(anon()), 'errorLogs/e3'), { message: 'boom', extra: 'field' }));
await no('error report needs every field', setDoc(doc(db(anon()), 'errorLogs/e4'), { message: 'boom', stack: 'stack', route: '/', uid: '', build: 'web-1' }));
await no('error report cannot backdate its timestamp', setDoc(doc(db(anon()), 'errorLogs/e5'), { message: 'boom', stack: 'stack', route: '/', uid: '', build: 'web-1', createdAt: new Date() }));
await no('nobody reads error reports back', readDoc(anon(), 'errorLogs/e2'));

// ---- donationTypes + guidelines -----------------------------------------
console.log('donationTypes');
await ok('signed-in reads a donation type', readDoc(as('alice'), 'donationTypes/whole-blood'));
await no('signed-out cannot read reference data', readDoc(anon(), 'donationTypes/whole-blood'));
await no('donor cannot change an interval', updateDoc(doc(db(as('alice')), 'donationTypes/whole-blood'), { intervalDays: 1 }));
await ok('admin claim edits reference data', updateDoc(doc(db(admin()), 'donationTypes/whole-blood'), { intervalDays: 56 }));
await ok('signed-in reads a guideline', readDoc(as('alice'), 'donationTypes/whole-blood/guidelines/g1'));
await no('donor cannot write a guideline', setDoc(doc(db(as('alice')), 'donationTypes/whole-blood/guidelines/g2'), { title: 't', description: 'd' }));

// ---- systemConfig --------------------------------------------------------
console.log('systemConfig');
await ok('signed-in reads systemConfig', readDoc(as('alice'), 'systemConfig/global'));
await no('donor cannot write systemConfig', updateDoc(doc(db(as('alice')), 'systemConfig/global'), { notifRetryLimit: 99 }));
await ok('admin claim writes systemConfig', updateDoc(doc(db(admin()), 'systemConfig/global'), { notifRetryLimit: 3 }));

// ---- hospitals + subcollections ------------------------------------------
console.log('hospitals');
await ok('signed-in reads hospitals', readDoc(as('alice'), 'hospitals/h1'));
await no('signed-out cannot read hospitals', readDoc(anon(), 'hospitals/h1'));
await ok('own staff edits hospital name', updateDoc(doc(db(staff1()), 'hospitals/h1'), { name: 'St. Mary General' }));
await no('own staff cannot change status', updateDoc(doc(db(staff1()), 'hospitals/h1'), { status: 'Suspended' }));
await no('staff of another hospital cannot edit', updateDoc(doc(db(staff2()), 'hospitals/h1'), { name: 'Nope' }));
await no('donor cannot edit a hospital', updateDoc(doc(db(as('alice')), 'hospitals/h1'), { name: 'Nope' }));
await ok('admin claim edits a hospital', updateDoc(doc(db(admin()), 'hospitals/h1'), { contactNumber: '09170000001' }));
await no('signed-out cannot create a hospital', setDoc(doc(db(anon()), 'hospitals/h2'), { name: 'x' }));

console.log('hospitals/subscriptions');
await ok('own staff reads subscriptions', readDoc(staff1(), 'hospitals/h1/subscriptions/s1'));
await no('staff of another hospital cannot read subscriptions', readDoc(staff2(), 'hospitals/h1/subscriptions/s1'));
await no('staff cannot write subscriptions', setDoc(doc(db(staff1()), 'hospitals/h1/subscriptions/s2'), { plan: 'x', startDate: new Date(), endDate: new Date(), status: 'Active' }));
await ok('admin claim writes subscriptions', setDoc(doc(db(admin()), 'hospitals/h1/subscriptions/s2'), { plan: 'pilot', startDate: new Date(), endDate: new Date(), status: 'Active' }));

console.log('hospitals/inventory');
await ok('own staff reads inventory', readDoc(staff1(), 'hospitals/h1/inventory/O+'));
await no('staff of another hospital cannot read inventory', readDoc(staff2(), 'hospitals/h1/inventory/O+'));
await ok('own staff updates units', updateDoc(doc(db(staff1()), 'hospitals/h1/inventory/O+'), { unitsAvailable: 4 }));
await no('donor cannot update inventory', updateDoc(doc(db(as('alice')), 'hospitals/h1/inventory/O+'), { unitsAvailable: 99 }));
await no('inventory doc must carry its blood type', updateDoc(doc(db(staff1()), 'hospitals/h1/inventory/O+'), { bloodType: 'A+' }));

console.log('hospitals/inventory/logs');
await ok('own staff appends an inventory log', setDoc(doc(db(staff1()), 'hospitals/h1/inventory/O+/logs/l1'), { donationId: null, userId: 'staff1', changeType: 'Usage', unitsChanged: -1, createdAt: serverTimestamp() }));
await no('inventory logs are append-only', updateDoc(doc(db(staff1()), 'hospitals/h1/inventory/O+/logs/l1'), { unitsChanged: 0 }));
await no('log shape is bounded', setDoc(doc(db(staff1()), 'hospitals/h1/inventory/O+/logs/l2'), { userId: 'staff1', changeType: 'Usage', unitsChanged: -1, createdAt: serverTimestamp(), extra: 1 }));
await no('donor cannot append an inventory log', setDoc(doc(db(as('alice')), 'hospitals/h1/inventory/O+/logs/l3'), { userId: 'alice', changeType: 'Usage', unitsChanged: -1, createdAt: serverTimestamp() }));

// ---- bloodRequests -------------------------------------------------------
console.log('bloodRequests');
await no('signed-out cannot post a request', setDoc(doc(db(anon()), 'bloodRequests/r2'), { hospitalId: 'h1', bloodType: 'O+', quantity: 1, urgencyLevel: 'urgent', status: 'urgent', hospitalName: 'x', latitude: 1, longitude: 1, geohash: 'a', createdAt: serverTimestamp() }));
await ok('signed-in posts a request', setDoc(doc(db(as('alice')), 'bloodRequests/r2'), { hospitalId: 'h1', recipientId: null, createdBy: 'alice', bloodType: 'O+', component: 'whole-blood', quantity: 1, urgencyLevel: 'urgent', status: 'urgent', hospitalName: 'St. Mary General', latitude: 14.609, longitude: 120.984, geohash: 'qc7bw', createdAt: serverTimestamp() }));
await ok('hospital post carries the facility fields (F3)', setDoc(doc(db(as('hosp1')), 'bloodRequests/r6'), { hospitalId: 'h1', recipientId: null, createdBy: 'hosp1', bloodType: 'A-', component: 'rbc', quantity: 4, urgencyLevel: 'stat', status: 'collecting', hospitalName: 'St. Mary General', latitude: 14.609, longitude: 120.984, geohash: 'qc7bw', createdAt: serverTimestamp() }));
await no('request needs a positive quantity', setDoc(doc(db(as('alice')), 'bloodRequests/r3'), { hospitalId: 'h1', bloodType: 'O+', quantity: 0, urgencyLevel: 'stat', status: 'collecting', hospitalName: 'x', latitude: 1, longitude: 1, geohash: 'a', createdAt: serverTimestamp() }));
await ok('signed-in reads the feed', readDoc(as('bob'), 'bloodRequests/r1'));
await no('signed-out cannot read requests', readDoc(anon(), 'bloodRequests/r1'));
await ok('own staff updates request status', updateDoc(doc(db(staff1()), 'bloodRequests/r1'), { status: 'matched' }));
await no('staff of another hospital cannot update', updateDoc(doc(db(staff2()), 'bloodRequests/r1'), { status: 'cancelled' }));
await no('the poster cannot update (staff/admin path, schema §6)', updateDoc(doc(db(as('alice')), 'bloodRequests/r1'), { status: 'cancelled' }));
await no('requests are never deleted', deleteDoc(doc(db(admin()), 'bloodRequests/r1')));
// D27: the recipient's position is denormalized so donors can see it.
await ok('request carries recipient coordinates', setDoc(doc(db(as('alice')), 'bloodRequests/r4'), { hospitalId: 'h1', recipientId: 'alice', createdBy: 'alice', bloodType: 'O+', quantity: 1, urgencyLevel: 'urgent', status: 'urgent', hospitalName: 'St. Mary General', latitude: 14.609, longitude: 120.984, geohash: 'qc7bw', recipientCity: 'Malolos', recipientLatitude: 14.84, recipientLongitude: 120.81, createdAt: serverTimestamp() }));
await no('recipient coordinates come as a pair', setDoc(doc(db(as('alice')), 'bloodRequests/r5'), { hospitalId: 'h1', bloodType: 'O+', quantity: 1, urgencyLevel: 'urgent', status: 'urgent', hospitalName: 'St. Mary General', latitude: 14.609, longitude: 120.984, geohash: 'qc7bw', recipientLatitude: 14.84, createdAt: serverTimestamp() }));

// ---- donorMatches --------------------------------------------------------
console.log('donorMatches');
await ok('donor reads own match', readDoc(as('alice'), 'donorMatches/r1_alice'));
await no('another donor cannot read a match', readDoc(as('bob'), 'donorMatches/r1_alice'));
await ok('staff of the request hospital reads the match', readDoc(staff1(), 'donorMatches/r1_alice'));
await no('staff of another hospital cannot read the match', readDoc(staff2(), 'donorMatches/r1_alice'));
await ok('admin claim reads a match', readDoc(admin(), 'donorMatches/r1_alice'));
await no('matches are created server-side only', setDoc(doc(db(as('alice')), 'donorMatches/r1_bob'), { requestId: 'r1', donorId: 'bob', donationTypeId: 'whole-blood', responseStatus: 'Pending', screeningStatus: null, guidelinesAcknowledged: false, acknowledgedAt: null, matchedAt: new Date() }));
await ok('donor responds and acknowledges', updateDoc(doc(db(as('alice')), 'donorMatches/r1_alice'), { responseStatus: 'Accepted', guidelinesAcknowledged: true, acknowledgedAt: new Date() }));
await no('donor cannot write screening fields', updateDoc(doc(db(as('alice')), 'donorMatches/r1_alice'), { screeningStatus: 'Cleared' }));
await no('donor cannot re-point a match', updateDoc(doc(db(as('alice')), 'donorMatches/r1_alice'), { donationTypeId: 'platelets' }));
await ok('staff writes the screening result', updateDoc(doc(db(staff1()), 'donorMatches/r1_alice'), { screenedByUserId: 'staff1', screeningStatus: 'Cleared' }));
await no('screening status follows the decided enum', updateDoc(doc(db(staff1()), 'donorMatches/r1_alice'), { screeningStatus: 'Green' }));
await no('matches are never deleted', deleteDoc(doc(db(admin()), 'donorMatches/r1_alice')));
// D27: coordinates ride the match so that hospital's staff can see them.
await no('coordinates need a share timestamp', updateDoc(doc(db(as('alice')), 'donorMatches/r1_alice'), { donorLatitude: 14.84, donorLongitude: 120.81 }));
await ok('donor shares coordinates at accept', updateDoc(doc(db(as('alice')), 'donorMatches/r1_alice'), { donorLatitude: 14.84, donorLongitude: 120.81, locationSharedAt: serverTimestamp() }));
await no('a donor cannot edit another donor’s match', updateDoc(doc(db(as('bob')), 'donorMatches/r1_alice'), { responseStatus: 'Declined' }));

// ---- donorConsents -------------------------------------------------------
console.log('donorConsents');
await ok('donor consents for themself', setDoc(doc(db(as('alice')), 'donorConsents/c2'), { donorId: 'alice', matchId: null, consentType: 'ProfileAccess', grantedAt: serverTimestamp(), revokedAt: null }));
await no('donor cannot consent in someone else’s name', setDoc(doc(db(as('alice')), 'donorConsents/c3'), { donorId: 'bob', matchId: null, consentType: 'ProfileAccess', grantedAt: serverTimestamp(), revokedAt: null }));
await ok('donor revokes (revokedAt only)', updateDoc(doc(db(as('alice')), 'donorConsents/c1'), { revokedAt: new Date() }));
await no('revocation cannot reshape the consent', updateDoc(doc(db(as('alice')), 'donorConsents/c1'), { consentType: 'Other' }));
await no('consents are never deleted', deleteDoc(doc(db(as('alice')), 'donorConsents/c1')));
await no('staff cannot read consents', readDoc(staff1(), 'donorConsents/c1'));
await ok('admin claim reads a consent', readDoc(admin(), 'donorConsents/c1'));

// ---- donorLocations (D28) -----------------------------------------------
console.log('donorLocations');
await ok('donor writes their own location', setDoc(doc(db(as('alice')), 'donorLocations/alice'), { donorId: 'alice', latitude: 14.84, longitude: 120.81, city: 'Malolos', geohash: 'wdt4', bloodType: 'O+', updatedAt: serverTimestamp() }));
await no('donor cannot write someone else’s location', setDoc(doc(db(as('alice')), 'donorLocations/bob'), { donorId: 'bob', latitude: 1, longitude: 1, updatedAt: serverTimestamp() }));
await no('a location needs coordinates', setDoc(doc(db(as('alice')), 'donorLocations/alice'), { donorId: 'alice', city: 'Malolos', updatedAt: serverTimestamp() }));
await ok('staff reads a donor location', readDoc(staff1(), 'donorLocations/alice'));
await ok('admin reads a donor location', readDoc(admin(), 'donorLocations/alice'));
await no('another donor cannot read a location', readDoc(as('bob'), 'donorLocations/alice'));
await no('signed-out cannot read a location', readDoc(anon(), 'donorLocations/alice'));
await no('locations are never deleted', deleteDoc(doc(db(as('alice')), 'donorLocations/alice')));

// ---- notifications -------------------------------------------------------
console.log('notifications');
await ok('owner reads own notification', readDoc(as('alice'), 'notifications/n1'));
await no('another user cannot read a notification', readDoc(as('bob'), 'notifications/n1'));
await no('notifications are written server-side only', setDoc(doc(db(as('alice')), 'notifications/n2'), { userId: 'alice', requestId: 'r1', channel: 'Email', deliveryStatus: 'Pending', retryCount: 0, sentAt: null }));

// ---- donations -----------------------------------------------------------
console.log('donations');
await ok('donor reads own donation history', readDoc(as('alice'), 'donations/r1_alice'));
await no('another donor cannot read a donation', readDoc(as('bob'), 'donations/r1_alice'));
await ok('staff of the hospital reads donations', readDoc(staff1(), 'donations/r1_alice'));
await no('staff of another hospital cannot read donations', readDoc(staff2(), 'donations/r1_alice'));
await ok('own staff records a donation', setDoc(doc(db(staff1()), 'donations/r2_alice'), { matchId: 'r2_alice', confirmedBy: 'staff1', donationDate: new Date(), units: 1, confirmedAt: new Date(), donorId: 'alice', hospitalId: 'h1', bloodType: 'O+' }));
await no('staff of another hospital cannot record a donation', setDoc(doc(db(staff2()), 'donations/r2_bob'), { matchId: 'r2_bob', confirmedBy: 'staff2', donationDate: new Date(), units: 1, confirmedAt: new Date(), donorId: 'bob', hospitalId: 'h1', bloodType: 'O+' }));
await no('donors cannot record their own donation', setDoc(doc(db(as('alice')), 'donations/r3_alice'), { matchId: 'r3_alice', confirmedBy: 'alice', donationDate: new Date(), units: 9, confirmedAt: new Date(), donorId: 'alice', hospitalId: 'h1', bloodType: 'O+' }));
await no('donations are never deleted', deleteDoc(doc(db(admin()), 'donations/r1_alice')));

// ---- rewardTransactions --------------------------------------------------
console.log('rewardTransactions');
await ok('donor reads own points', readDoc(as('alice'), 'rewardTransactions/r1_alice'));
await no('another donor cannot read points', readDoc(as('bob'), 'rewardTransactions/r1_alice'));
await no('points are written server-side only', setDoc(doc(db(as('alice')), 'rewardTransactions/r1_alice'), { donorId: 'alice', donationId: 'r1_alice', points: 9999, awardedAt: new Date() }));

// ---- dataSubjectRequests -------------------------------------------------
console.log('dataSubjectRequests');
await ok('requester opens their own request', setDoc(doc(db(as('alice')), 'dataSubjectRequests/dsr2'), { userId: 'alice', processedBy: null, requestType: 'Erasure', status: 'Pending', createdAt: serverTimestamp(), resolvedAt: null }));
await no('requester cannot open one for someone else', setDoc(doc(db(as('alice')), 'dataSubjectRequests/dsr3'), { userId: 'bob', processedBy: null, requestType: 'Erasure', status: 'Pending', createdAt: serverTimestamp(), resolvedAt: null }));
await no('requester cannot process their own request', updateDoc(doc(db(as('alice')), 'dataSubjectRequests/dsr1'), { status: 'Completed' }));
await ok('admin claim processes a request', updateDoc(doc(db(admin()), 'dataSubjectRequests/dsr1'), { status: 'Completed' }));
await no('data-subject requests are never deleted', deleteDoc(doc(db(admin()), 'dataSubjectRequests/dsr1')));

// ---- auditBlocks + server-only + catch-all -------------------------------
console.log('auditBlocks / server-only / catch-all');
await ok('admin claim reads the audit chain', readDoc(admin(), 'auditBlocks/b1'));
await no('donors cannot read the audit chain', readDoc(as('alice'), 'auditBlocks/b1'));
await no('even admins do not write audit blocks from the client', setDoc(doc(db(admin()), 'auditBlocks/b2'), { prevHash: 'abc123', recordHash: 'def456', eventType: 'X', hashedEntityRef: 'h', hashedActorRef: 'a', createdAt: new Date(), sequence: 2 }));
await no('emailVerifications are server-only', readDoc(as('alice'), 'emailVerifications/v1'));
await no('anything else is denied', readDoc(as('alice'), 'someCollection/x'));

// ---- report --------------------------------------------------------------
await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
