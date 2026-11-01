# Data retention and disposal guidelines

**Feature:** F11 · **Requirement:** NFR-17, NFR-19, NFR-18
**Status:** documented policy. There is **no scheduled purge job**; disposal is
manual, or happens as part of an erasure request.

This document states how long each kind of data is kept, the reason, and how it
is removed. It is the reference the notice and the admin queue point at.

## 1. Retention table

| Data | Kept while | After that | Reason |
| --- | --- | --- | --- |
| `users/{uid}` profile | account is active | erasure request scrubs the identifying fields and closes the account; a suspended/removed profile is kept for audit until then | account function + audit |
| Firebase Auth sign-in record (email) | account exists | deleted on erasure through the account service | least data after closure |
| `donorConsents/{uid}` | indefinitely | never deleted; withdrawal keeps the record | RA 10173 accountability — the controller must show the consent it relied on |
| `donations` | indefinitely, de-identified after erasure | not deleted | blood-safety traceability (DOH AO 2020-0030 VII(b)(15)) |
| `donorMatches` | retained with the donation history | not deleted | traceability of a donation |
| `rewardTransactions` | retained with the donation history | not deleted | donor record |
| `bloodRequests` | retained | not deleted | history of the request |
| `dataSubjectRequests` | retained | not deleted | proof a request was handled |
| `notifications` | operational lifetime | no purge job | operational |
| `errorLogs` | troubleshooting | no purge job | fault-finding; holds no profile data beyond an optional uid |
| `auditBlocks` | indefinitely | append-only, never updated or deleted | tamper-evident audit trail (D2) |

## 2. What "de-identified" means here

After an erasure, the profile's identifiers (name, email, phone, city,
coordinates, blood type, date of birth) are scrubbed and the account is `Removed`.
Donation and match rows keep their own document ids (`{requestId}_{donorId}`,
`donations/{matchId}`) so the blood-safety chain stays intact, but they no longer
resolve to a readable identity. The audit chain stores hashed references, not
readable personal data (D2).

## 3. Withdrawal vs erasure

- **Withdrawing consent** stops hospital access; it does not erase anything.
  The consent record is kept, and donation records stay as they are.
- **Erasure** is a data-subject request. It withdraws consent first, then scrubs
  the profile and closes the account. It still leaves de-identified donation and
  audit records, for the reasons above.

## 4. Disposal methods

| Medium | Method |
| --- | --- |
| Firestore documents | field scrub (`anonymiseUser`) or, for the Auth record, deletion by the account service; consent and audit records are intentionally not deleted |
| Browser error reports | create-only collection; no reader; no automated purge yet |
| Backups (if enabled) | governed by the Firebase/GCP project; see `docs/PHASES.md` NFR-08a/b — no export job exists yet |

## 5. Open items

1. **No automated retention job.** A scheduled Cloud Function (Blaze) or a
   worker job would be needed to purge error logs and closed requests on a
   schedule. Not built.
2. **Retention periods are not legally fixed.** The periods above are working
   choices that need approval by the project owner and a privacy professional.
3. **Backups.** Whether automated Firestore backups exist, and how erasure is
   reflected in them, is an ops question (NFR-08a/b), not answered here.
4. **The rules are not deployed**, so this policy is not yet live-enforced on
   the production project.
