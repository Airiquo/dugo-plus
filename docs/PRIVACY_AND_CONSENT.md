# Privacy and consent — what is written, what still needs a human

**Features:** F9 (registration consent, data requests) · F11 (hospital-access
consent, compliance)
**Requirements:** FR-019 (compliance half), NFR-16, NFR-17, NFR-18, NFR-19
**Notice in the app:** `/privacy` (`web/src/pages/public/PrivacyPolicy.jsx`),
version `2026-11-01`
**Linked from:** `/register` (before the account is created), `/donor/privacy`
and `/donor/consent`.
**Long-form policy:** `docs/PRIVACY_POLICY.md`; procedure:
`docs/CONSENT_AND_WITHDRAWAL.md`.

This file records what the shipped text claims, so a claim can be checked
against the code. It is **not** a legal opinion.

## Written text

`web/src/pages/public/PrivacyPolicy.jsx` is the notice a donor agrees to at
registration. It covers:

| Topic | What it says |
| --- | --- |
| Data held | name, email, phone, role, status, blood type, birth date, city, optional coordinates/geohash, matches, donations, points, hospital-access consent, posted requests, data-subject requests, error reports, hashed audit references |
| Purpose | matching donors to requests, donation history and deferral, answering requests, security and fault-finding |
| Readers | the account owner, admin claim, and hospital staff only after the donor's hospital-access consent, for the listed categories |
| Storage | Firebase (Cloud Firestore + Authentication); Google encrypts in transit and at rest; access enforced by Firestore rules |
| Consent | registration acceptance is separate from hospital-access consent; the hospital gate is consent + version + scope, enforced in the rules |
| Retention | profile while active; erasure withdraws consent, scrubs identifying fields, closes the account and deletes the sign-in record; consent, donation and audit rows are retained under their reasons |
| Rights | informed, access, correct, object, erase/block, portability, NPC complaint; health information per DOH AO 2020-0030 |
| Requests | `/donor/privacy` → `/admin/data-requests`, 15-working-day target |
| Limits | explicitly not a legal opinion, not certified compliant, DPO and retention schedule outstanding |

## Verified against the code

| Claim | Where it is true |
| --- | --- |
| Only the owner, an admin claim, or a consent-cleared hospital staff `get` reads `users/{uid}` | `firestore.rules` `match /users/{uid}` + `hasHospitalConsent()` (D32) |
| No hospital can list donors; there is no directory | `firestore.rules` `allow list: if isAdmin()` |
| A hospital donor read needs a granted, current, full-scope consent | `firestore.rules` `hasHospitalConsent()`; `docs/CONSENT_AND_WITHDRAWAL.md` |
| A donor cannot write another donor's consent; an admin can only revoke | `firestore.rules` `match /donorConsents/{uid}` |
| Registration acceptance is not hospital-access consent | separate records: `users.privacyConsentAt` vs `donorConsents/{uid}` (D32) |
| Hospital staff read only their own hospital's matches, donations and stock | `firestore.rules` `isStaffOf(...)` branches |
| Role cannot be raised from the browser | `users` update freezes `role`; admin authority is the `role == 'admin'` claim |
| A suspended/removed account loses every protected path | `accountActive()` in `firestore.rules`; `Blocked.jsx` |
| Erasure scrubs the identifying fields | `anonymiseUser()` in `web/src/services/users.js` |
| The Auth sign-in record is deleted as part of erasure | `deleteAuthAccount` in `functions/index.js` (not deployed in this checkout), called from `/admin/accounts` |
| Registration acceptance is recorded with the notice version | required checkbox in `web/src/pages/public/Register.jsx`; `writeProfile()` stores `privacyConsentAt` + `privacyNoticeVersion`; owner-frozen in `firestore.rules`; shown in `/admin/accounts` |
| Requests are owner-create, admin-process | `firestore.rules` `match /dataSubjectRequests/{dsrId}` |
| No service-account key in the web app | privileged work is `functions/` or `scripts/*.mjs` with a key outside the repo |

## Not verified / needs a human

1. **RA 10173 compliance has not been assessed by a lawyer.** Rules and a
   notice are not a compliance certificate.
2. **No Data Protection Officer and no dedicated privacy mailbox are named.**
   The notice points at support@dugoplus.ph as an interim contact and says the
   DPO is an open item rather than implying one exists.
3. **Retention schedule is a policy, not a job.** No scheduled purge exists
   for error logs, closed requests or removed profiles
   (`docs/DATA_RETENTION_AND_DISPOSAL.md`).
4. **Encryption is Google's platform default.** In-transit is evidenced (HSTS);
   at-rest is not console-verified, and there is no field-level encryption
   (`docs/ENCRYPTION_AND_FIREBASE_SECURITY.md`).
5. **Neither consent record is a copy of the notice text.** The profile stores
   the registration acceptance (`privacyConsentAt`, notice `2026-11-01`); the
   hospital-access record stores the consent version (`2026-11-01`), scope and
   purpose. Keep the previous notice text when the wording changes if a signed
   copy is ever needed.
6. **The consent gate is not live-verified.** The rules are written and asserted
   in `firestore.rules.test.mjs`; the emulator suite **ran green on 2026-11-01
   (156 asserts, 0 failed**, via a portable Temurin JRE 21 because the machine
   has no system Java). The rules are still **not deployed** to the live project
   and no signed-in smoke has run (PHASES §10), so the claims are
   emulator- and review-backed, not live-proven.
7. **A first Google sign-in from `/login` records no registration acceptance**
   (it auto-provisions a donor), and a donor registered before F11 is treated as
   **not consented** for hospital access until they agree. That is the intended
   conservative default.
8. **Children.** The register screen has no age gate; the notice says 18+
   nowhere explicit yet. Owner decision needed.
