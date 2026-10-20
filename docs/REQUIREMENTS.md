# Dugo+ Requirements Traceability (FR/NFR → implementation)

Single source of truth for what the system must implement. Every requirement
from the System Analysis spec has exactly one row here.

## How to use this file

- A task that implements or changes something covered by a requirement updates
  that row in the same task (Status + Where/evidence).
- **Status** vocabulary: `done` (built + verified), `partial` (some behaviour
  exists, acceptance not fully met), `not started`.
- **Class** says what kind of work the row needs: `app-code` (React app),
  `firestore-rules`, `cloud-function`, `external-service` (provider keys/3rd
  party), `ops-config` (Firebase/GCP console or CI), `compliance-doc`
  (policy/consent text), or a combination. Rows that are not `app-code` cannot
  be finished by frontend code alone.
- The Phase column orders the work (P1–P9); it does not mean one session
  builds a whole phase. One screen/component per task.
- **Feature** names the feature that completes the row, or features, when a row
  is finished across several (for example FR-037 is F3 for the hospital list and
  F7 for the matcher queue). The feature roster, with each feature's name and
  phase, is in `docs/PHASES.md` §4. A feature is the unit of work: one person,
  taken to working.
- ID note: the spec alternates `FR-01` and `FR-001` style numbering;
  `FR-001`–`FR-004` (referenced elsewhere in the spec) are the same rows as
  `FR-01`–`FR-04` below.

## Decisions

| # | Decision | Affects |
| --- | --- | --- |
| D1 | Recipient is **merged into the donor role** (`donor \| hospital \| admin`, no 4th role). A donor both gives and receives. | FR-011, FR-040 — "recipient" wording maps to the donor account |
| D2 | "Blockchain" = **hash chain stored in Firestore**, appended by Cloud Functions (`prevHash + payloadHash + timestamp`), rules deny update/delete, admin verifies by walking the chain. | FR-035, FR-042–045, NFR-15 |
| D3 | Notifications behind a **pluggable provider**: email path live, SMS activates when provider keys exist; until then the UI reports the service unavailable. | FR-007, NFR-02, NFR-07, NFR-09 |
| D4 | Maps = **Leaflet + OpenStreetMap** (no API key); locations stored as GeoPoint + geohash, feeding both the map and the tiered-radius matcher. | FR-015, FR-022, FR-023, NFR-05 |
| D5 | **Email verification is a gate, not an advisory link.** An unverified session cannot reach a built screen; `layout/RequireVerified.jsx` sends it to `/verify-email`, which offers resend, "I've verified", and sign out. Stricter than the requirement text asks (FR-01/NFR-12 say "link"). | FR-01, NFR-12 |
| D6 | **Admins bypass the gate by construction, not by a role check.** Console-created accounts are verified by Firebase on creation, so `RequireVerified` reads only `emailVerified`. | D5 |
| D7 | **"Start over" removed.** The notice screen offers resend, "I've verified", and sign out; an unverified account stays blocked on that screen rather than being re-registered. | D5 |
| D8 | **NFR-27 split**: `app-code` half (logging seam + error boundary) built now; `cloud-function` half deferred. | NFR-27 |
| D9 | **NFR-14 deferred** (idle session timeout) — descoped for now, not dropped. | NFR-14 |
| D10 | **Error records are written by the client** to `errorLogs` (create-only rules), not by a Cloud Function: Spark-compatible, at the cost of the writer not being a trusted boundary. | NFR-27 |

## Functional Requirements — Account Management (Donor & Recipient)

| ID | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-01 | Register with personal details, blood type, contact info + email verification link | app-code | P1 | done | F1 | Register form + verification email on signup (`services/auth.js` `sendEmailVerification`), `/verify-email` screen (`pages/public/VerifyEmail.jsx`); personal details, blood type and contact are captured on `/donor/profile` (`pages/donor/Profile.jsx`, FR-04). **D5: verification is a gate** — `layout/RequireVerified.jsx` (mounted in `App.jsx` over `/donor/profile` and `/admin/*`) holds an unverified session on `/verify-email`; `Register.jsx`/`Login.jsx` route unverified sessions there. Mail delivery, link verification, the gate lifting, and resend all confirmed working on 2026-10-20 (see `docs/PHASES.md`) |
| FR-02 | Log in with credentials, maintain secure session | app-code | — | done | F1 | `pages/public/Login.jsx`, `hooks/useAuth.jsx` |
| FR-03 | Log out, ending the session | app-code | — | done | F1 | `hooks/useAuth.jsx`, `layout/AppShell.jsx` |
| FR-04 | Create/edit profile: blood type, location, DOB, eligibility | app-code + firestore-rules | P1 | done | F1 | `/donor/profile` (`pages/donor/Profile.jsx`); `users/{uid}` holds `{role,name,email,bloodType,dateOfBirth,contact.phone,location{GeoPoint,geohash,city,address},lastDonationAt,updatedAt}` (`services/users.js` `readProfile`/`saveProfile`); rules freeze `role` and validate field types (`firestore.rules`) |

## Functional Requirements — Donor

| ID | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-005 | Browse blood requests filtered by compatibility + proximity (tiered radius, NFR-05) | app-code | P3 | not started | F4 | Planned: donor request-list screen |
| FR-006 | Accept/decline a request, status updates in real time | app-code | P3 | not started | F4 | Planned: donor request-list screen + live query |
| FR-007 | Emergency SMS + email to matched donors | app-code + cloud-function + external-service | P5 | not started | F7 | D3: pluggable provider, email first |
| FR-008 | Donation history: dates, locations, facilities | app-code | P3 | not started | F5 | Planned: donor history screen |
| FR-009 | View accumulated points and rewards | app-code | P3 | not started | F5 | Planned: donor rewards screen |
| FR-010 | Health tracker: eligibility status + next donation date | app-code | P3 | partial | F1, F5 | Eligibility derived read-only from DOB + `lastDonationAt` (`utils/eligibility.js`), shown on `/donor/profile` with the next eligible date; the dedicated donor tracker screen is still to build |
| FR-023 | Precise geolocation of hospitals within donor radius on map | app-code | P3 | not started | F4 | D4: Leaflet component |
| FR-024 | Block new Whole Blood donation until 56 days since last | app-code | P3 | not started | F8 | Eligibility engine (from confirmed donations) |
| FR-025 | Block new Platelet donation until 7 days | app-code | P3 | not started | F8 | Eligibility engine |
| FR-026 | Block new Plasma donation until 28 days | app-code | P3 | not started | F8 | Eligibility engine |
| FR-027 | Block new Double Red Cell donation until 112 days | app-code | P3 | not started | F8 | Eligibility engine |
| FR-028 | Show eligibility guidelines for the selected donation type before accepting a request | app-code | P3 | not started | F4 | Planned: accept-flow gate |
| FR-029 | Require acknowledgment checkbox before accepting | app-code | P3 | not started | F4 | Planned: accept-flow gate |
| FR-030 | Record acknowledgment date/time in request history | app-code + firestore-rules | P3 | not started | F4 | Match/participation document |
| FR-036 | Auto-award reward points once hospital confirms donation | cloud-function | P4/P5 | not started | F8, F10 | Triggered by FR-033 confirmation |
| FR-038 | Obtain and record donor consent before hospital access to profile | app-code + firestore-rules | P3/P8 | not started | F4, F11 | Consent collection + rules gate (NFR-16) |

## Functional Requirements — Recipient

| ID | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-011 | Submit a blood request: blood type, quantity, urgency, hospital location | app-code | P2 | not started | F3 | D1: served by donor account; planned request form |

## Functional Requirements — Hospital

| ID | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-012 | Hospital staff log in/out with role-based credentials | app-code | — | done | F1 | Hospital role + `Login.jsx` + `RequireRole.jsx` |
| FR-013 | Edit/maintain hospital profile | app-code | P4 | not started | F6 | Planned: hospital settings screen |
| FR-014 | View total blood units collected over a period | app-code | P4 | not started | F6 | Planned: hospital dashboard |
| FR-015 | View hospital location on a map | app-code | P4 | not started | F6 | D4: Leaflet |
| FR-016 | List active blood requests in their facility | app-code | P2 | not started | F3 | Planned: hospital requests screen |
| FR-017 | Create requests on behalf of recipients, route to matching donors | app-code | P2 | not started | F3 | Planned: hospital new-request form (routing → P5) |
| FR-018 | Manage hospital subscription plan | app-code + firestore-rules | P4 | not started | F6 | Planned: hospital billing screen |
| FR-020 | Check blood inventory levels + view donation history | app-code | P4 | not started | F6 | Planned: hospital inventory screen |
| FR-021 | Submit emergency requests by compatibility + proximity (tiered radius) | app-code + cloud-function | P2/P5 | not started | F3, F7 | Form in P2, matching in P5 |
| FR-031 | Route matched donors to hospital for final eligibility verification | app-code | P4 | not started | F8 | Screening workflow. The donor-facing half exists: eligibility is derived, never self-declared (`utils/eligibility.js`), and the profile states a facility confirms at the donation itself |
| FR-032 | Mark donor Cleared / Deferred / Rejected after screening | app-code | P4 | not started | F8 | Screening workflow |
| FR-033 | Update donation history only after staff confirms donation (interval basis) | app-code + cloud-function | P4 | not started | F8 | Confirmation action feeds FR-024–027 |
| FR-034 | Add/update blood inventory after donation or transfusion | app-code + firestore-rules | P4 | not started | F6 | Planned: hospital inventory screen |

## Functional Requirements — System Administration

| ID | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-040 | Create hospital accounts; suspend/remove hospital + donor accounts (self-registration stays per FR-01) | app-code + firestore-rules | P6 | partial | F9 | Admin role gate exists (`RequireRole`); no account-management UI |
| FR-041 | Configure system parameters: tiered radius, notification retry | app-code + cloud-function | P5/P6 | not started | F7, F9 | Settings screen in P6 reads by matcher in P5 |
| FR-046 | Admin log in/out with role-based credentials | app-code | — | done | F1 | `Login.jsx`, `RequireRole` `roles={['admin']}`, `App.jsx` |
| FR-047 | Admin views own account profile | app-code | P6 | partial | F9 | Name/email shown in `AppShell` topbar; no profile page |

## Functional Requirements — System Wide / Cross Cutting

| ID | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-019 | Access controls + encryption for donor/recipient data (RA 10173) | firestore-rules + ops-config + compliance-doc | P1/P8 | partial | F9 | `firestore.rules` covers `users/*` only; profile fields (`bloodType`, `contact`, `location`) validated by type and `role` frozen on update; other collections pending |
| FR-022 | Show precise geolocation of donors and recipients after a match | app-code | P4 | not started | F4 | D4: Leaflet, post-match view |
| FR-035 | Authorized users view blockchain-based audit log | app-code + cloud-function | P7 | not started | F10 | D2: hash-chain viewer |
| FR-037 | Prioritize higher-urgency requests in matching queue + hospital list | app-code | P2/P5 | not started | F3, F7 | Sort order in hospital list (P2) and matcher (P5) |
| FR-039 | Users submit access/correct/delete data requests; admin processes them | app-code + firestore-rules | P6 | not started | F9 | Data-request queue |
| FR-042 | Commit a blockchain record for every donation confirmation, inventory update, data-access event, at action time | cloud-function | P7 | not started | F10 | D2 |
| FR-043 | Committed records unmodifiable; corrections append as linked entries | firestore-rules + cloud-function | P7 | not started | F10 | D2 |
| FR-044 | Admin verifies a record's hash against the chain | app-code + cloud-function | P7 | not started | F10 | D2: verify walk |
| FR-045 | Chain stores only hashed/non-identifying refs so PII deletion still works | cloud-function + firestore-rules | P7 | not started | F10 | D2 |
| FR-048 | Donors/Recipients/Hospital reset password via verified channel; admins excluded (premade accounts) | app-code | P1 | done | F1 | `/forgot-password` (`pages/public/ForgotPassword.jsx`) + `sendPasswordReset` (`services/auth.js`); linked from `/login`; generic confirmation so no account is revealed |

## Non-Functional Requirements

| ID | Category | Requirement | Class | Phase | Status | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-01 | Performance | Match request to eligible nearby donors within 3s | cloud-function | P5 | not started | F7 | Matcher timing instrumentation |
| NFR-02 | Performance | SMS/email to matched donors within 3s of a match | cloud-function + external-service | P5 | not started | F7 | D3 fan-out timing |
| NFR-03 | Performance | Support ≥500 concurrent users without noticeable degradation | ops-config + app-code | P9 | not started | F12 | Load test evidence (k6/artillery) |
| NFR-04 | Performance | Donor dashboard, request list, hospital dashboard load ≤3s | app-code | P9 | not started | F12 | Measured timings |
| NFR-05 | Performance | Tiered radius matcher (5→10→15→20–25 km), search <5s | cloud-function | P5 | partial | F7 | Geohash encoding and storage done (`utils/geohash.js`, `location.geohash` on `users/{uid}`); the tiered-radius query + timing is still to build |
| NFR-06 | Reliability | 99.5% availability | ops-config | P9 | not started | F12 | Hosting SLA + uptime check evidence |
| NFR-07 | Reliability | Keep request active; retry notification on SMS/email failure | cloud-function | P5 | not started | F7 | Retry queue in fan-out |
| NFR-08a | Reliability | Automated backups of all data to cloud storage | ops-config | P9 | not started | F12 | Scheduled Firestore export |
| NFR-08b | Reliability | Full backup ≥ every 24h; active requests/matches in real time | ops-config | P9 | not started | F12 | Daily export + PITR/real-time story |
| NFR-09 | Reliability | Handle third-party outages (SMS/email/GPS) and inform the user | app-code + cloud-function | P5 | not started | F7 | D3 unavailable-state messaging |
| NFR-10 | Security | Encrypt sensitive data at rest and in transit | ops-config + compliance-doc | P8 | not started | F11 | Verify Firestore default encryption + TLS; document |
| NFR-11 | Security | Restrict donor data to authorized hospital users + admin (RBAC) | firestore-rules | P1/P8 | partial | F9, F12 | `users/*` is owner-read, owner-write with `role` frozen and profile fields type-checked (`firestore.rules`); per-collection RBAC for hospital/admin reads pending |
| NFR-12 | Security | Email verification on registration | app-code | P1 | done | F2 | `sendEmailVerification` in `signUp` (`services/auth.js`); `/verify-email` re-reads the user via `reloadCurrentUser` and forwards once verified. **D5: enforced as a gate** — `layout/RequireVerified.jsx` holds an unverified session on `/verify-email`; admins pass by construction (D6). Stricter than the requirement text, which asks for a link, not a gate. Mail delivery, link verification, the gate lifting, and resend all confirmed working on 2026-10-20 (see `docs/PHASES.md`) |
| NFR-13 | Security | Password ≥8 characters with complexity | app-code | P1 | done | F2 | `utils/password.js` `passwordProblem` (8+, letter + digit, not the email); enforced at Register before the request |
| NFR-14 | Security | End session after inactivity | app-code | P1 | not started | F12 | **Deferred by D9** — idle timer → signOut; restated each session until answered, withdrawn, or cancelled |
| NFR-15 | Security | Tamper-evident blockchain-based audit trail | cloud-function + firestore-rules | P7 | not started | F10 | D2 hash chain |
| NFR-16 | Security | Donor consent before hospital access to donor information | app-code + firestore-rules | P3/P8 | not started | F4, F11 | FR-038 consent + rules gate |
| NFR-17 | Compliance | Data Privacy Act of 2012 (RA 10173) compliance | compliance-doc + app-code | P8 | not started | F11 | Consent/privacy copy + data rights flows |
| NFR-18 | Compliance | DOH AO 2020-0030 health-data privacy guidelines | compliance-doc | P8 | not started | F11 | Privacy copy + handling rules |
| NFR-19 | Compliance | Mechanism to request access/correction/deletion of personal data | app-code | P6/P8 | not started | F9, F11 | FR-039 flow |
| NFR-20 | Usability | Simple/intuitive for first-time users with low technical literacy | app-code | P9 | partial | F12 | Auth card restructured (`/login`): clearer subline, in-field password reveal, and a footer note stating hospital/admin accounts are team-provided — usability pass still pending |
| NFR-21 | Usability | Clear, immediate error messages in plain language | app-code | P9 | partial | F12 | Auth errors mapped per field (`services/auth.js` `ERROR_INFO` + `authErrorDetail`); all forms check every field on submit and render each message under its input (`utils/validate.js`, `components/FieldError.jsx`, applied to Login/Register/ForgotPassword/VerifyEmail); `aria-invalid` + `aria-describedby` + `role="alert"`. Finding: `dugo-plus` has email-enumeration protection on, so sign-in collapses unknown-email and wrong-password to `auth/invalid-credential` (verified live) — the undistinguishable case shows a card-level message rather than blaming a field. Full-screen audit still pending |
| NFR-22 | Usability | Low-connectivity support with clear messaging | app-code | P5/P9 | not started | F12 | Offline/error states |
| NFR-23 | Usability | Hospital dashboard scannable for time-pressured staff | app-code | P4 | not started | F6, F12 | Hospital dashboard layout |
| NFR-24 | Scalability | Expand to more hospitals/areas without redesigning matcher | cloud-function + compliance-doc | P9 | not started | F12 | Architecture note + load evidence |
| NFR-25 | Scalability | Donor database grows without significant performance loss | ops-config + app-code | P9 | not started | F12 | Indexes + load evidence |
| NFR-26 | Maintainability | Modular architecture, features updatable independently | app-code | P9 | partial | F12 | Layered `web/src/` layout exists; evidence write-up pending |
| NFR-27 | Maintainability | Log system errors and exceptions | app-code + cloud-function | P1 | partial | F2, F10 | **D8: row split.** `app-code` half done: `services/log.js` (`errorRecord`+`logError`, message/stack/route/uid/build), `layout/ErrorBoundary.jsx` wired in `main.jsx`, plus `error`/`unhandledrejection` hooks; records go to `errorLogs`, create-only and shape/size capped in `firestore.rules` (**D10**: client-written). `cloud-function` half still to do: Function-side logging needs the Blaze plan |
| NFR-28 | Compatibility | Donor/Recipient access via Android/iOS mobile web | app-code | P9 | partial | F12 | Responsive design system; verification pass pending |
| NFR-29 | Compatibility | Hospital/Admin access via browser dashboard | app-code | P9 | partial | F12 | `AppShell` desktop layout; verification pass pending |

## Closeout criteria (P10)

- [ ] Every row Status = `done` with a Where/evidence entry that points at real files or run results.
- [ ] Every non-`app-code` class row has its external/config/compliance evidence recorded (console config, provider keys, load-test run, policy text).
- [ ] `cd web && npx vite build` passes.
- [ ] README updated to describe the shipped system.
