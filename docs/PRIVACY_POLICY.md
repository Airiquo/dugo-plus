# Dugo+ Privacy Policy (working document)

**Feature:** F11 · **Requirement:** NFR-17 (RA 10173), NFR-10
**In-app notice:** `/privacy` (`web/src/pages/public/PrivacyPolicy.jsx`), version
`2026-11-01` (`web/src/utils/privacy.js`)
**Status:** written and implemented in the app; **not legally reviewed**

This document is the long form of the notice a person reads at `/privacy`. It
records what Dugo+ actually collects and does, so a claim can be checked against
the code. It is **not a legal opinion** and does not certify RA 10173 compliance.

## 1. Who is responsible

Dugo+ is a blood-donation service for the Philippines. The Dugo+ team decides
what is collected and answers requests. The contact address used by the app is
`support@dugoplus.ph`.

> **Gap for the project team:** no Data Protection Officer is named, and no
> dedicated privacy mailbox exists. Both are required for a complete RA 10173
> position and must be supplied by the owner before this can be called final.

## 2. What is collected

| Category | Fields | Where |
| --- | --- | --- |
| Account | full name, email, phone, account type (`donor \| hospital \| admin`), status | `users/{uid}` |
| Donor profile | blood type, date of birth, city, optional coordinates + coarse geohash | `users/{uid}` |
| Donation activity | matches, donations, reward points, posted blood requests | `donorMatches`, `donations`, `rewardTransactions`, `bloodRequests` |
| Consent | hospital-access consent: type, version, scope, purpose, status, grant/withdraw times, reason | `donorConsents/{uid}` |
| Registration acceptance | notice version and acceptance time | `users/{uid}` (`privacyConsentAt`, `privacyNoticeVersion`) |
| Requests | data-subject requests and the administrator's note | `dataSubjectRequests` |
| Operational | browser error reports (optional uid); hashed audit references | `errorLogs`, `auditBlocks` |

Blood type, date of birth, last-donation date and screening results are
**health-related** and are handled as sensitive (see
`docs/HEALTH_INFORMATION_HANDLING.md`).

## 3. Why it is collected

- show eligible donors near a blood request and let a hospital invite them;
- keep donation history and the deferral interval that protects the donor's health;
- answer access, correction, export and erasure requests;
- keep the service secure and investigate faults.

## 4. How it is used and shared

- **You** see your own profile, consent and requests.
- **Dugo+ administrators** use it for account management, support and requests.
  They may read a consent record to answer a request but **cannot grant consent**
  for a donor; they can only withdraw it when they close an account for an
  erasure.
- **Hospital staff** may open a donor profile **only after that donor agrees** on
  `/donor/consent`, and only the fields that screen lists (name, contact, blood
  type, date of birth, city, last donation date). Staff cannot list donors and
  cannot read the consent record itself. The gate is enforced by
  `firestore.rules`, not by the screen (D32, NFR-16).
- **Other donors** cannot read your profile, matches, donations, consent or
  requests.

Dugo+ does not sell personal data and does not share it with third parties
beyond the Firebase platform that hosts it.

## 5. How it is stored and protected

Data lives in Google Firebase (Cloud Firestore and Firebase Authentication).
Google encrypts data in transit and at rest as part of the platform; the
in-transit header and the at-rest default are recorded in
`docs/ENCRYPTION_AND_FIREBASE_SECURITY.md`. Access is enforced by server-side
Firestore rules: a suspended or removed account loses every protected read and
write, a browser role change does not grant administrator access, and a hospital
donor read is refused unless the consent record is current and granted. Dugo+
does not hold a service-account key in the web app.

## 6. Consent

Two records are kept, and they mean different things:

1. **Registration acceptance** (`privacyConsentAt`, `privacyNoticeVersion`,
   D28) — accepting this notice to create an account. It is **not** consent for a
   hospital to open the profile.
2. **Hospital-access consent** (`donorConsents/{uid}`, D32) — the donor's
   explicit agreement to hospital access to listed fields. It is optional, can
   be granted and withdrawn at any time on `/donor/consent`, and is enforced by
   the security rules. Donors registered before F11 are treated as **not
   consented** until they agree.

Withdrawal stops future access immediately. It does not undo processing that
already happened, and it does not delete a donation record kept for blood
safety. The withdrawn consent record itself is kept as evidence that consent
once existed and was withdrawn. See `docs/CONSENT_AND_WITHDRAWAL.md`.

## 7. Access, correction, erasure and portability

Sign in and open `/donor/privacy` to submit an access, correction, export or
erasure request. An administrator works the queue at `/admin/data-requests`,
performs the work and records the action. The target response time is **15
working days**. See `docs/PERSONAL_DATA_REQUESTS.md`.

Erasure withdraws any hospital-access consent, scrubs the identifying profile
fields, closes the account, and the sign-in record that holds the email is
deleted through the account service. Donation, match and audit records are kept
in de-identified form under the retention reasons in
`docs/DATA_RETENTION_AND_DISPOSAL.md`.

## 8. Retention

The profile stays while the account is active. Suspended and removed profiles
are kept for audit until a deletion request is processed. Consent records are
kept as evidence. Error reports are kept for troubleshooting. There is currently
**no scheduled purge job** — retention is a documented policy, not an automated
one. See `docs/DATA_RETENTION_AND_DISPOSAL.md`.

## 9. Your rights under RA 10173

You may ask to be informed, to access, to correct, to object, to have data erased
or blocked, and to receive a copy in a portable format. You may complain to the
National Privacy Commission. For health information, Dugo+ follows DOH
Administrative Order No. 2020-0030; see
`docs/HEALTH_INFORMATION_HANDLING.md`.

## 10. What is still open

1. Legal review of this policy and the consent wording by a qualified privacy
   professional.
2. A named Data Protection Officer and a dedicated privacy mailbox.
3. A privacy impact assessment for the health-related processing.
4. A scheduled retention and disposal job.
5. Console evidence for Firebase at-rest encryption and a decision on whether
   field-level encryption is needed.
6. The Firestore ruleset carrying the consent gate is written and asserted but
   **not deployed** (PHASES §10), and no signed-in live smoke has run here.
