# Schema changelog

Every change to the data model, in order. **Append-only** — new entries at the
bottom, and an entry is never edited or removed.

This file is the *history*; `docs/firestore_schema.md` is the *snapshot* of the
current state. §0 of the schema says what differs right now and is what you read
before building; this file says how the model got there.

## What an entry records

- **Date** and the change, stated as data — the collection or field, and what
  moved.
- **Origin** — `ERD` (the schema text changed to match `ERD.drawio`) or `build`
  (the build moved, and the schema was updated to record it).
- **Refs** — the `D*` row in `docs/REQUIREMENTS.md` that carries the decision,
  and the `F*` feature when one owns the work. A `D*` is required whenever the
  change departs from what the schema previously said or from the ERD; a plain
  new field inside an existing collection needs only the `F*` when it is part of
  a feature's task.

`node tools/check-docs.mjs` validates this file: every `D*` reference must
resolve to a row in `docs/REQUIREMENTS.md`.

---

## 2026-10-22 — `users` aligned to §2.1

**Origin:** build → schema (the shipped shape was moved to match the model).

| Field | Before | After |
|---|---|---|
| `name` | shipped | → `fullName` |
| `contact.phone` | shipped | → `phoneNumber` |
| `location{coordinates, geohash, city, address}` | shipped | → flat `latitude` / `longitude` / `geohash` / `city` |
| `address` | shipped (ERD postal address) | **removed** — not collected |
| `status` | not present | **added** — `Active \| Suspended \| Removed`, default `Active`, admin-writable |
| `hospitalId` | not present | **added** — optional |
| `role` enum | `Donor \| Recipient \| Staff \| Admin` (ERD) | `donor \| hospital \| admin` |
| `isVerified` | declared in §2.1 | **removed** — Firebase Auth owns email verification |

**Refs:** D22, D16 (resolved by D22), D5, D1. Features: FR-04, FR-019, FR-040.

`status` and `hospitalId` are written but no screen reads them yet; the admin
donor-registry screen (F9/F10) is what will. Recorded as a stated gap in D22 and
`docs/PHASES.md` §10.

## 2026-10-22 — live `users` backfill

**Origin:** build (data migration, no schema text moved).

**Refs:** D22.

`scripts/backfill-users-shape.mjs` (`npm run backfill:users`) migrated the live
`dugo-plus` `users` collection to the shape above: 12 documents, verified
read-back (no legacy keys left, all new fields present and correctly typed), and
a re-run was a clean no-op. The temporary old-name fallbacks in `readProfile`
were removed in the same task, once no document could reach them.

## 2026-10-24 — `auditBlocks` extended for corrections

**Origin:** build → schema (F10a adds correction linkage for FR-043).

| Field | Before | After |
|---|---|---|
| `entityType` | not present | **added** — optional, type of affected entity |
| `actorRole` | not present | **added** — optional, role of actor |
| `correctsBlockId` | not present | **added** — optional, links to corrected block for append-only corrections |

**Refs:** FR-043, F10.

## 2026-10-22 — `bloodRequests` enums and `component`

**Origin:** build → schema (the shipped vocabulary was recorded; the ERD had no
usable values).

| Field | Before | After |
|---|---|---|
| `status` | ERD `Active \| Suspended \| Removed` (a copy-paste error, noted in §9) | `urgent \| collecting \| matched \| fulfilled \| cancelled` |
| `urgencyLevel` | unspecified ("suggested `Low \| Medium \| High \| Critical`") | `urgent \| stat \| routine` |
| `component` | not present | **added** — FK → `donationTypes/{id}` |

**Refs:** D24. Feature: FR-006 (requests), FR-03x (matching).

Both enums are the codes the shipped `.chip[data-status]` / `.chip[data-priority]`
tones render, so they are read off the fixtures rather than chosen. `urgent` sits
in both enums; that overlap is deliberate and noted in §2.4.

## 2026-10-22 — `eligibilityInfo` removed

**Origin:** build (the field was declared but never implemented).

**Refs:** D25. Feature: FR-031.

The ERD's `eligibility_info` was an optional free-form map with no structure,
no reader and no writer. Eligibility is **computed on read** from `dateOfBirth`
and `lastDonationAt` (`utils/eligibility.js`) and `firestore.rules` refuses a
write containing an `eligibility` key — that guard's name is the key it blocks,
not a field. The placeholder was removed from §2.1 and §9 marked answered; a
screening record, if ever needed, gets a purpose-designed field in its feature.

## 2026-10-27 — `users` status metadata and `dataSubjectRequests.adminNote` (F9)

**Origin:** build.

**Refs:** D26, D23. Feature: F9.

Added `users.statusReason` (string, optional) and `users.statusUpdatedAt` (Timestamp, optional) for admin suspension/reactivation (D26). Added `dataSubjectRequests.adminNote` (string, optional) for manual export/erasure notes recorded by the admin queue. `firestore.rules` allow admins to update `status`/`statusReason`/`statusUpdatedAt` on `users` and update `dataSubjectRequests` fully (admin-only). Server script for hospital creation (`scripts/create-hospital.mjs`) is specified in D26 but not present in this checkout; accounts UI will create/edit facility records and suspend/reactivate (D26).

## 2026-10-22 — framing: the schema is the model of record

**Origin:** build (documentation of the process the repo already followed).

**Refs:** D23.

Not a data change, recorded because it changes what every later entry means.
§0.1 said "Implement exactly the collections and fields below. Do not invent
collections" — a flat ban. It now states the add-and-record rule: a builder may
add a collection or field the design needs, writes it into the schema and this
file in the same task, and adds a `D*` row when it departs from what is written.
`[ADDED]` no longer means "Firestore mechanics only", and "single source of
truth" became "model of record".

Also folded into this entry: §1 gained `errorLogs` (§0 had recorded it, the tree
had not), the shared `Role` enum was lowercased to match §2.1, and §1 notes that
`systemConfig/global` is a singleton in practice while the rules match
`{configId}`.

## 2026-10-27 — `bloodRequests.matching` added

**Origin:** build (the F7 matcher writes state the schema had no home for).

**Refs:** F7.

| Field | Before | After |
|---|---|---|
| `bloodRequests.matching` | not present | **added** — server-written matcher state `{ currentTier, nextTierAt, lastRunAt, lastRunMs, matchedDonorCount, exhausted }`; clients never write it |

No `D*`: it is a new field inside an existing collection that nothing written
contradicted. Recorded late — the F7 build wrote it before the schema note.

Also clarified in the same pass, not a data change: `notifications.sentAt` (§2.8)
must be written as an explicit `null` at create, because the donor inbox query
orders by it and Firestore omits documents missing an orderBy field (the pending
notifications were invisible until then).

Also added: `auditBlocks/_meta`, a reserved head document `{ headSequence,
headHash, updatedAt }` with no `sequence` field (so the chain queries skip it).
Appends read it inside a transaction to serialize, replacing the untransactional
read-then-write that could fork the chain (schema §5, §2.13).

## 2026-10-29 — `dataSubjectRequests` request detail and resolution; `systemConfig` bounds (F9)

**Origin:** build.

**Refs:** D27, D26, D23. Feature: F9.

| Field | Before | After |
|---|---|---|
| `dataSubjectRequests.details` | not present | **added** — string, ≤2000 chars, required on create |
| `dataSubjectRequests.resolutionAction` | not present | **added** — `'' \| Export \| Correction \| Deletion`, written when the queue closes a request |
| `dataSubjectRequests.requestType` | "suggested" values | the decided set `Access \| Rectification \| Erasure \| Export`, enforced by the rules |
| `dataSubjectRequests.status` | "suggested" values | the decided set `Pending \| InProgress \| Completed \| Rejected`, enforced by the rules |
| `dataSubjectRequests.resolvedAt` | optional | required (server time) when `Completed`/`Rejected`, null while open |
| `systemConfig.notifRetryLimit` | unbounded int | 0–10 |
| `systemConfig.notifRetryInterval` | unbounded int | 1–1440 minutes |
| `systemConfig.radiusTiers` | 1–8 items, shape suggested | 1–8 items, each `tierOrder` 1–8, `radiusKm` 1–100, `waitMinutes` 1–1440 |
| `systemConfig.updatedBy` | admin FK | must equal the writer's uid |
| `systemConfig.updatedAt` | server time | must equal `request.time` |

The queue now performs the work the request asks for rather than only recording
it: an access/export request builds a JSON copy of the subject's records
(`web/src/services/dataExport.js`), a rectification writes the corrected profile
fields, and an erasure scrubs the identifying fields and closes the profile
(`anonymiseUser()` in `web/src/services/users.js`). The 2026-10-27 entry's note
that `scripts/create-hospital.mjs` was absent is resolved: that script, plus the
`createHospitalAccount` / `deleteAuthAccount` callables in `functions/index.js`,
now perform hospital account creation. Neither is deployed in this checkout
(Blaze plan), and no live smoke has run.

`docs/PRIVACY_AND_CONSENT.md` and `/privacy` record the data handling these
fields serve.

## 2026-10-29 — `users` registration consent record (F9)

**Origin:** build.

**Refs:** D28, D23. Feature: F9.

| Field | Before | After |
|---|---|---|
| `users.privacyConsentAt` | not present | **added** — Timestamp, server time the notice was accepted on `/register`; owner-frozen (D28) |
| `users.privacyNoticeVersion` | not present | **added** — string, the `/privacy` notice version accepted (currently `2026-10-29`); owner-frozen (D28) |

Both fields are optional because accounts provisioned outside registration (a
first Google sign-in, hospital accounts created by the team) have no recorded
acceptance. The rules type-check them on create and on admin writes, and the
owner branch freezes presence and value, so an acceptance cannot be rewritten or
removed from the browser. `/register` now requires a checkbox and blocks both
"Create account" and "Continue with Google" until it is ticked
(`web/src/utils/privacy.js`, `web/src/pages/public/Register.jsx`). The admin
account view shows the recorded date and version.

Not deployed: the live project still enforces the 2026-10-21 ruleset
(PHASES §10), so the freeze is written and tested in the suite but not live yet.


## 2026-11-01 — Recoverable account operations and audit contexts (D40)

Feature: F9/F10. Adds server-only `accountOperations`, `auditOutbox`,
`auditContexts` and `auditRedactions`; due-work indexes on state/nextAttemptAt.
Adds profile login/provisioning/erasure metadata and facility provisioning
ownership. Adds optional `auditBlocks.contextHash` without changing old hashes.
Profile access fields are now server-owned, including for browser admins.
Erasure creates persistent hash-only tombstones; bounded jobs delete erasable
context while preserving the chain. See schema §2.15–2.18 and
`docs/ADMIN_ACCOUNT_OPERATIONS.md`. Written and emulator-tested, not deployed.

## 2026-11-01 — optional account profile picture

**Origin:** build → schema.

Added optional `users/{uid}.photoURL`: a Cloudinary HTTPS image delivery URL, bounded to 2048 characters. Missing/empty values use initials. Active owners of all three account types may edit their own picture; admin writes use the same URL validation. Anonymisation clears the field. Image storage and provider deletion are outside Firestore. No new collection or index.

**Refs:** D39; F1, F9; FR-04, FR-012, FR-047.

## 2026-11-02 — single donor commitment and alert read state (D42/D43)

- Added server-owned `donorCommitments/{donorId}` for serialized acceptance.
- Added optional server-written `notifications.readAt` for unread inbox state.
- Donor match responses/acknowledgment/location now commit through the donor API;
  rules deny direct donor response edits. Both consent records commit atomically.
- Reward transactions are legacy-only; future award seeding is removed (D43).
## 2026-11-02 — Account-history query (D50)

Adds an `auditBlocks` composite index on `hashedEntityRef` ASC, `entityType` ASC, `sequence` DESC for the active-admin account-history endpoint. Pages contain at most 25 user-entity events with an exclusive sequence continuation. Existing `auditContexts` and actor/subject `auditRedactions` control private details. No new collection or field. Index/Worker deployment pending; unit and REST-emulator checks pass.

## 2026-11-02 — Continuous discovery on open requests (D51)

Clarifies `bloodRequests.matching.exhausted`: the radius ladder is complete,
but `urgent`/`collecting` requests continue searching the maximum radius for
later eligible donors. Intermediate-tier rescans preserve `nextTierAt`;
`lastRunAt` also orders rotation through scheduled batches. No collection,
field, rule or index is added. Five isolated matching REST-emulator checks pass;
production Worker deployment remains pending.

## 2026-11-02 — Hospital location locks and audited profile edits (D52)

Documents the existing optional `hospitals.city` written by hospital provisioning
and adds `editProfile` to `accountOperations.action`. The admin editor updates
allowed donor/staff fields, the linked facility, and a donor's location mirror
in one transaction with its `Account.ProfileUpdated` audit-outbox event. Existing
erasable audit reason context includes changed field names and the required
reason; no identifying before/after values are added to the immutable chain.
No new collection, field or index is needed for the operation.

Hospital owners cannot change city/coordinates/geohash on their profile; staff
cannot change facility address/city/coordinates/geohash. Existing request
location snapshots are preserved. Worker, Hosting and rules deployment remain
pending; local REST, security-rules and browser verification is recorded in
`docs/ACCOUNT_PROFILE_EDITING.md`.


## 2026-11-02 — Global audit activity query indexes

- **Origin:** build, F10/F12, D56.
- Added eight `auditBlocks` composite indexes: all subsets of account (`hashedEntityRef`, `entityType`), actor (`hashedActorRef`), and event (`eventType`) equality fields, ending in `createdAt DESC, sequence DESC`.
- No stored field, collection, or rules permission changes. Deploy additive indexes before the updated Worker and Hosting; runtime readiness must be checked.

## 2026-11-03 — Trusted hospital inventory operations (D63)

Owner chooses existing Cloudflare Worker transactions, administrator-only facility address/location changes, a separate staff facility-details page, removal of partnership plan management, and component/group stock identity.

- Inventory IDs become `{component}_{bloodType}` with required component/group fields; group-only legacy rows remain preserved, unclassified, read-only and excluded from usable counts.
- Movement logs include component/group and optional reason. Worker-only confirmation/movements atomically write stock, logs, operation receipts and audit outbox; donation confirmation also writes donation/component/request fields and the donor clock.
- Add server-only `inventoryOperations/{operationHash}` receipts. Confirmation keys bind the match; other operations bind actor+UUID. Fingerprints reject changed-input reuse.
- Add optional matcher `donorBloodType` display snapshot, and server-owned `bloodRequests.transfusedUnits` for partial issuance. Actual confirmation uses the current donor profile and active consents.
- Deny browser stock/log/donation/screening/clock writes; retain the prior admin-only subscription boundary and stored records while removing its self-service UI.

No automatic data migration or production deployment occurs in this task. See `HOSPITAL_WORKER_RECONCILIATION.md` for local evidence and rollout.


### 2026-11-04 — request reacceptance and Completed donations (D79)

- Add match donationStage, acceptanceVersion and stage/withdrawal/deferral timestamps/actors; require a written deferralReason and make Deferred terminal.
- Add donation status Completed and completedAt/completedBy, retaining confirmedAt/confirmedBy compatibility aliases and historical completion reads.
- Link donation stock logs to requestId as well as donationId; retain component/donor-group stock identity and atomic stock/history/clock/audit writes.
- Archive superseded consent grants with acknowledgment/version at deterministic versioned IDs; renew current grants atomically and retain revoked history.
- Release only the terminal attempt's commitment; reaccept renews consent and acknowledgment, resets progress, and increments acceptanceVersion to reject stale staff writes.
- Add bounded donation history equality indexes; private context is fetched only on explicit detail requests through the current consent gate. See `REQUEST_DONATION_COMPLETION_CONTRACT.md`.
## 2026-11-04 — data-request Other and rejection retention

**Origin:** build → schema. **Refs:** D80, F9 (FR-039/NFR-19).

`dataSubjectRequests.requestType` adds `Other`; `details` must contain non-whitespace text and remain ≤2000 characters. Optional `rejectionReason` adds `InsufficientDetails | Duplicate | OutsideScope | Other` (empty while not rejected); new rejections require the category and a nonblank `adminNote` ≤2000 characters. `resolutionAction` adds `Response` for written Other answers. Completed requests require a nonblank response and recorded action. Closed records cannot be updated/deleted by clients. Historical rejected records without the new field remain readable, with original details/responses/timestamps retained. No migration, collection, index, Worker endpoint or notification behavior change.

## 2026-11-04 — facility donor directory read index (D82)

**Origin:** build → schema. **Refs:** D82, F6, F11.

Added `donations(hospitalId ASC, donorId ASC)` for bounded facility donor-ID
directory cursors and hospital+donor history reads. No new fields, collections,
client permissions or data writes. Current visit-specific consent and active,
unerased donor profiles gate batched identity reads in the Worker. Historical
confirmed and canonical Completed donations share the read mapping; no stock is
replayed. Verification/rollout limits: `docs/HOSPITAL_DONORS_DIRECTORY.md`.

## 2026-11-04 — Donor identity (D94)

Add optional `users.gender` with Female/Male/Other/Prefer not to say choices.
Email/password registration collects gender, birth date and blood group before
creating the profile; existing and Google accounts complete missing fields later.
Gender remains editable. Blood group/birth date retain their existing owner lock.
Age is computed from birth date for staff displays and is never persisted or
introduced to the matcher contract. Current consent-gated response/directory
shapes include gender and birth date; erased profiles clear gender. No index or
new collection. Legacy profiles need no backfill.
