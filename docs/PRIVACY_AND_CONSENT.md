# Privacy and consent — what is written, what still needs a human

**Feature:** F9 · **Requirement:** FR-019 (compliance half), NFR-19
**Notice in the app:** `/privacy` (`web/src/pages/public/PrivacyPolicy.jsx`)
**Linked from:** `/register` (before the account is created) and
`/donor/privacy`.

This file records what the shipped text claims, so a claim can be checked
against the code. It is **not** a legal opinion.

## Written text

`web/src/pages/public/PrivacyPolicy.jsx` is the notice a donor agrees to at
registration. It covers:

| Topic | What it says |
| --- | --- |
| Data held | name, email, phone, role, status, blood type, birth date, city, optional coordinates/geohash, matches, donations, points, consents, posted requests, data-subject requests, error reports, hashed audit references |
| Purpose | matching donors to requests, donation history and deferral, answering requests, security and fault-finding |
| Readers | the account owner, admin claim, and hospital staff only for their own hospital's matches/donations/stock |
| Storage | Firebase (Cloud Firestore + Authentication); Google encrypts in transit and at rest; access enforced by Firestore rules |
| Retention | profile while active; erasure scrubs identifying fields, closes the account and deletes the sign-in record; donation/audit rows are retained de-identified |
| Rights | informed, access, correct, object, erase/block, portability, NPC complaint |
| Requests | `/donor/privacy` → `/admin/data-requests`, 15-working-day target |
| Limits | explicitly not a legal opinion, not certified compliant, DPO and retention schedule outstanding |

## Verified against the code

| Claim | Where it is true |
| --- | --- |
| Only the owner or an admin claim reads `users/{uid}` | `firestore.rules` `match /users/{uid}` |
| Hospital staff read only their own hospital's matches, donations and stock | `firestore.rules` `isStaffOf(...)` branches |
| Role cannot be raised from the browser | `users` update freezes `role`; admin authority is the `role == 'admin'` claim |
| A suspended/removed account loses every protected path | `accountActive()` in `firestore.rules`; `Blocked.jsx` |
| Erasure scrubs the identifying fields | `anonymiseUser()` in `web/src/services/users.js` |
| The Auth sign-in record is deleted as part of erasure | `deleteAuthAccount` in `functions/index.js` (not deployed in this checkout), called from `/admin/accounts` |
| Requests are owner-create, admin-process | `firestore.rules` `match /dataSubjectRequests/{dsrId}` |
| No service-account key in the web app | privileged work is `functions/` or `scripts/*.mjs` with a key outside the repo |

## Not verified / needs a human

1. **RA 10173 compliance has not been assessed by a lawyer.** Rules and a
   notice are not a compliance certificate.
2. **No Data Protection Officer is named.** The notice points at
   support@dugoplus.ph as an interim contact.
3. **Retention schedule is a policy, not a job.** No scheduled purge exists
   for error logs, closed requests or removed profiles.
4. **Encryption is Google's platform default.** There is no field-level
   encryption; the notice says so by not claiming more.
5. **Consent evidence** is the registration notice plus `donorConsents`
   documents for hospital access; there is no separate consent checkbox with a
   version stamp.
6. **Children.** The register screen has no age gate; the notice says 18+
   nowhere explicit yet. Owner decision needed.
