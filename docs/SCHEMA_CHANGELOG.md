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

## 2026-10-31 — inventory movements move to the server

**Origin:** build (FR-034 rewritten as callables).

**Refs:** D26. Feature: F6 (FR-034, FR-020).

| Area | Before | After |
|---|---|---|
| `hospitals/{h}/inventory/{bt}` writes | staff-of-that-hospital or admin claim, client transaction | **server-only** — `firestore.rules` denies create/update/delete; `functions/index.js` writes with the Admin SDK |
| `.../logs/{id}` writes | staff/admin create, shape validated in rules | **server-only**, same denial; shape (and the new `reason`) validated in the callable |
| `logs.changeType` | suggested `Donation \| Usage \| Adjustment \| Expired` (§9.5 open) | `DONATION \| TRANSFUSION \| ADJUSTMENT \| EXPIRED` |
| `logs.reason` | not present | **added** — optional, required by the callable for `ADJUSTMENT` / `EXPIRED` |
| log location | `hospitals/{h}/inventory/{bt}/logs/{id}` | **unchanged** — a top-level `inventoryLogs` collection was considered and rejected; the deployed ruleset and its tests already enforce the child path |
| `donations/{matchId}` | matchId, donorId, hospitalId, bloodType, units, dates | **added** `donorName`, `donationType`, `requestId` — denormalised from the match/request at confirmation so history lists need no join |

§9.5's `changeType` question is answered by this change, and §0 carries the
divergence row.
