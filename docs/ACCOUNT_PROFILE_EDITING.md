# Hospital locations and admin profile corrections (D52/D53)

The hospital profile displays the linked facility's address, city, contact,
coordinates and map pin. Its location is read-only. Loading, unavailable,
unlinked-facility and missing-pin states are explicit. Security rules freeze
city/latitude/longitude/geohash on hospital-owned user profiles and restrict
staff facility updates to name/contact number.

Accounts provides an **Edit details** action for donor/hospital accounts whose
sign-in remains available and whose status is Active or Suspended. Protected,
erased, removed and provisioning/deleting/deleted accounts explain why editing
is disabled. The editor supports:

- Contact name and account phone.
- Donor blood type, date of birth, city and saved location.
- Facility name, address, city, contact number and saved location.
- Hospital creation and editing with click-to-pin, draggable pins, keyboard
  pinning, map-centre pinning, or numeric coordinates.

Email, role, facility identity, donation history and access state are not part
of this profile mutation. Hospital location corrections apply to future blood
requests; existing requests retain their original name/location snapshots.

## Server and audit contract

`GET /accounts/profile?uid=…` requires the admin custom claim and an Active admin
profile and returns allowlisted current details plus a keyed revision.
`POST /accounts` with `action: updateAccountProfile` uses the existing v2
operation/retry contract. It requires that revision, a reason of 1–1500
characters and allowlisted profile/facility fields. The server validates strings,
blood types, calendar dates and coordinate pairs and computes geohashes itself.
Stale revisions fail before writes. Reloading current details discards the
editor's draft; network/server errors leave the draft available for retry.

Profile/facility updates, donor location-mirror create/update/delete, operation
completion and `Account.ProfileUpdated` outbox creation commit in one transaction.
Retries create one event and preserve the completed result. The immutable chain
stores hashed subject/actor references, event type, time and context digest.
The existing erasable context records changed field names and the administrator's
reason; no identifying before/after field values are added to the chain.
Account history shows the event, current actor identity and verified context;
the global Audit Trail's existing polling displays the new event type too.
An audit delivery outage reports completion with audit pending and leaves the
durable outbox available for scheduled delivery.

Tapping or keyboard-activating a hospital pin on the donor map now centres it
and zooms to at least level 16 while preserving closer zoom levels. The popup
and its View request action remain. Reduced-motion preference disables the
flight animation.

## Verification (2026-11-02)

- 97 unit/regression tests pass, including allowed field corrections, invalid
  payloads, protected accounts, stale revisions, transaction rollback/retry,
  audit idempotency, offline delivery, mirror removal and no-op rejection.
- 16 combined REST-emulator tests pass (six account/audit, five donor responses,
  five matching).
  The final six-test account suite was rerun after adding the mirror's donor ID.
  HTTP checks cover token authority, donor/facility saves, repeated operations,
  stale edits, verified account history and a valid audit chain.
- 222 security-rule checks pass, including hospital-owner location freezes and
  staff address/city/coordinate denials, while contact edits remain allowed.
- Thirty isolated UI combinations pass: hospital profile, hospital creation
  and hospital editing at 360/390/768/1024/1440px, in light/dark themes, with no
  page or dialog overflow. Real map click/drag/centre pinning submits the
  selected coordinates. Donor edits require a reason; audit-pending feedback,
  missing/error/unpinned facilities and failed-detail-load recovery pass. A
  simulated failed save at phone width focuses the error, preserves the draft
  and succeeds on retry.
- Donor map browser checks verify hospital centring, zoom 16, keyboard
  activation, popup/request action and both reduced-motion settings.
- Actual app against local Auth/Firestore emulators passes sign-in to `/home`,
  saved-profile reload, save/reload persistence, unverified-email gating and
  missing-configuration rendering. No real credentials/accounts were used.
- Frontend build passes (existing large-bundle warning remains). Worker dry-run
  bundling passes with lockfile-compatible cached Wrangler 4.152.0 (116.10 KiB).
  Compiled frontend includes the edit action, facility location and donor-pin
  focus behavior; the Worker bundle includes the new read/edit handlers.
- `node tools/check-docs.mjs` passes (78 rows, 12 features, 53 decisions), and
  `git diff --check` passes.

UI fixtures and proof are isolated under
`/private/tmp/dugo-account-location-qa` and
`/private/tmp/dugo-account-location-proof`; they do not write Firebase/Worker
production data. The auth/REST/rules suites use demo emulator projects.

## Rollout

No production deployment or account mutation is included. Deploy the Worker
first, then Hosting and the tightened Firestore rules. No new index or data
migration is required. Existing v2 operations keep their contract; an older
Worker cannot perform the new profile-edit action and the editor reports a
load/save error. The previous D51 matching fix is included in this branch.
Production provider/IAM and real-device smoke remain release checks.
