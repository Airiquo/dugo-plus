# Security and incident handling procedures

**Feature:** F11 · **Requirements:** NFR-18, NFR-10, NFR-17
**Status:** technical safeguards described from the code; the organisational
incident procedure is a working draft that **needs an owner and legal review**.

## 1. Security controls in the build

| Control | Where |
| --- | --- |
| Role-based access on custom claims (`role`, `hospitalId`), never the client-written `users.role` | `firestore.rules` (`isAdmin`, `isStaff`, `isStaffOf`) |
| Suspended/removed accounts lose every protected path | `accountActive()`, `layout/RequireAuth.jsx`, `pages/public/Blocked.jsx` |
| Hospital donor access requires current granted consent | `hasHospitalConsent()`, `donorConsents/{uid}` (D32) |
| No donor directory; staff cannot list `users` | `firestore.rules` `allow list: if isAdmin()` |
| Consent records: owner grant/withdraw, admin revoke-only, never deleted | `firestore.rules` `donorConsents` |
| Data-subject requests: owner-create, admin-process, frozen fields | `firestore.rules` `dataSubjectRequests` |
| Append-only, hashed audit chain (no client write) | `firestore.rules` `auditBlocks` (D2) |
| Email verification as a route gate | `layout/RequireVerified.jsx` (D5) |
| Confidential transport (HTTPS/HSTS) | Firebase Hosting; see `docs/ENCRYPTION_AND_FIREBASE_SECURITY.md` |
| Browser error reports, no reads back | `errorLogs` create-only (D17) |

What the build **does not** have: a WAF, rate limiting on the public form,
field-level encryption, MFA for admins, or a standing security monitoring tool.

## 2. Incident classes

1. **Credential compromise** — a donor, hospital or admin account is taken over.
2. **Privilege misuse** — a staff or admin account reads or changes data it
   should not.
3. **Misconfiguration** — a rules or index change opens data by accident.
4. **Data exposure** — personal or health data appears in a URL, log, export or
   third-party system.
5. **Availability** — the service or its Firebase dependencies are unavailable.

## 3. Response steps (working draft)

1. **Contain.** Suspend the affected account at `/admin/accounts` (`status:
   Suspended` or `Removed`) — this closes every protected path in the rules
   (D26). If the exposure is a rule, roll the rules back to the last known-good
   release with `firebase deploy --only firestore:rules`.
2. **Assess.** Determine what was accessed, for which donors, and whether health
   information was involved. `donorConsents`, `dataSubjectRequests` and
   `auditBlocks` are the records to inspect.
3. **Notify.** If personal data was actually accessed by an unauthorised party,
   RA 10173 and the NPC rules require notification. **The officer, the template
   and the timelines are not yet defined — owner action required.**
4. **Remediate.** Fix the rule, code or operational cause; re-run
   `npm run test:rules` and the §6 smoke list before restoring service.
5. **Record.** Keep a written incident record, including what was exposed and
   the decision made.

## 4. Hardening actions to schedule

- Turn on Firebase App Check for Firestore.
- Add rate limiting or a CAPTCHA to the public `/partner` form.
- Require MFA for admin accounts in the Firebase console.
- Add an uptime/alerting check (NFR-06).
- Decide whether the health fields need field-level encryption (see
  `docs/ENCRYPTION_AND_FIREBASE_SECURITY.md`).

## 5. Contact

The app currently points at `support@dugoplus.ph`. A **named security/privacy
contact** with the authority to start an incident response has not been
published; that is the single biggest organisational gap in this document.
