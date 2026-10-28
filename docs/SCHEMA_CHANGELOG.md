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

## 2026-10-27 — hospital-creation script corrected

**Origin:** build (F3/F4/F9 integration; naming correction).

**Refs:** D26.

Not a data change. The F9 entry above named `scripts/create-hospital.mjs`, which
was never present. The merged build has one parameterized script,
`scripts/create-hospital-account.mjs` (Auth user + `hospitals/{id}` +
`users/{uid}` with `role: 'hospital'`), with custom claims published separately
by `scripts/set-claims.mjs`. The earlier `scripts/create-hospital-user.mjs`
(same job, hardcoded dev values) was removed in the same change.
