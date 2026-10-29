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
