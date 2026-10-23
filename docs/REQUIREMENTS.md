# Dugo+ Requirements Traceability (FR/NFR → implementation)

Single source of truth for what the system must implement. Every requirement
from the System Analysis spec has exactly one row here.

## How to use this file

- A task that implements or changes something covered by a requirement updates
  that row in the same task (Status + Notes + Where/evidence).
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
- **Notes** holds deviations and changes: a `D*` reference from the Decisions
  table, a descope, or where the build is stricter or looser than the requirement
  text. **Required whenever Status moves to `done` or `partial`**; a dash means
  the row was built as written. Where/evidence does not restate a decision: state
  the fact once, in Notes, and point at it.
- ID note: the spec alternates `FR-01` and `FR-001` style numbering;
  `FR-001`–`FR-004` (referenced elsewhere in the spec) are the same rows as
  `FR-01`–`FR-04` below.

## Decisions

| # | Decision | Affects |
| --- | --- | --- |
| D1 | Recipient is **merged into the donor role** (`donor \| hospital \| admin`, no 4th role). A donor both gives and receives. | FR-011, FR-040 — "recipient" wording maps to the donor account |
| D2 | "Blockchain" = **hash chain stored in Firestore**, appended by Cloud Functions (`prevHash + payloadHash + timestamp`), rules deny update/delete, admin verifies by walking the chain. | FR-035, FR-042–045, NFR-15 |
| D3 | Notifications behind a **pluggable provider**: email path live, SMS activates when provider keys exist; until then the UI reports the service unavailable. | FR-007, NFR-02, NFR-07, NFR-09 |
| D4 | Maps = **Leaflet + OpenStreetMap** (no API key); locations stored as flat `latitude`/`longitude` numbers + geohash (not a Firestore `GeoPoint` — D22), feeding both the map and the tiered-radius matcher. | FR-015, FR-022, FR-023, NFR-05 |
| D5 | **Email verification is a gate, not an advisory link.** An unverified session cannot reach a built screen; `layout/RequireVerified.jsx` sends it to `/verify-email`, which offers resend, "I've verified", and sign out. Stricter than the requirement text asks (FR-01/NFR-12 say "link"). | FR-01, NFR-12 |
| D6 | **Admins bypass the gate by construction, not by a role check.** Console-created accounts are verified by Firebase on creation, so `RequireVerified` reads only `emailVerified`. | D5 |
| D7 | **"Start over" removed.** The notice screen offers resend, "I've verified", and sign out; an unverified account stays blocked on that screen rather than being re-registered. | D5 |
| D8 | **NFR-27**: client-written to `errorLogs` (create-only rules); no Cloud Function required. | NFR-27 |
| D9 | **NFR-14 deferred** (idle session timeout) — descoped for now, not dropped. | NFR-14 |
| D10 | **Error records are written by the client** to `errorLogs` (create-only rules), not by a Cloud Function: Spark-compatible, at the cost of the writer not being a trusted boundary. | NFR-27 |
| D11 | **Hosting = Firebase Hosting**, site `dugo-plus.web.app`. Deploy branch is `prod`, which is only ever fast-forwarded from `main`; the deploy itself is manual via `tools/deploy.sh` (`npm run build` then `firebase deploy --only hosting`). Firestore rules deploy stays a separate, deliberate command. | NFR-10, closeout |
| D12 | Reward points are **one record per donation** (`rewardTransactions/{donationId}` — 100 whole blood / 150 platelets / 30 per plasma unit, per the admin mockups); the donor's total is **summed on read**, never stored on the profile. | FR-009, FR-036 |
| D13 | Deferral intervals are **per component** — whole blood 56, platelets 7, plasma 28, double red cells 112 days — stored in `donationTypes/{id}.intervalDays`, replacing `DONATION_INTERVAL_DAYS = 90`. | FR-024–FR-027, FR-031 |
| D14 | `users/{uid}.lastDonationAt` is **frozen for the owner** — presence and value, checked on create and update — so a donor cannot shorten a deferral by editing it; only F8's server transaction writes it. | FR-033, FR-031, FR-04 |
| D15 | Admin/staff rules key on **Firebase Auth custom claims** (`request.auth.token.role`, `.hospitalId`), never the client-written `users.role`; server-only collections have no client write path, and `scripts/seed-reference-data.mjs` (Admin SDK) is the only writer of reference data. Claims are still outstanding, so admin/staff rules match no session until they are set (PHASES §10). | FR-019, NFR-11, FR-012, FR-040 |
| D16 | **Resolved by D22.** The `users` rules and shape previously diverged from schema §2.1 (built `name`/`contact.phone`/nested `location`, four-role enum); the alignment task brought the build to the schema instead, so the divergence no longer exists. | FR-019, NFR-11, FR-04 |
| D17 | **`errorLogs` stays open-create for unauthenticated writers** — the NFR-27 logger runs on public screens where nobody is signed in; the spam cost is accepted, bounded by shape/size checks and denied reads. Reaffirms D8/D10 against the schema's closed-write pattern. | NFR-27 |
| D18 | **`radiusTiers` seeds follow NFR-05's 5→10→15→20–25 km ladder** (5 tiers: 5/10/15/20/25 km), not schema §8's illustrative 3 tiers; §8 is corrected in the same commit. `waitMinutes` extends the documented 10/15/20 pattern and stays tunable (FR-041). | NFR-05, FR-041 |
| D19 | The **rules suite runs in CI**: a `rules` job in `.github/workflows/checks.yml` runs `firestore.rules.test.mjs` in the emulator, so a weakened security boundary fails the PR instead of waiting for someone to run it by hand. | FR-019, NFR-11, NFR-27 |
| D20 | **Self-registration is donor-only.** `/register` creates donor accounts; the role picker, `/account/role` and `claimRole` are removed. A session whose `users/{uid}` document is missing (first Google sign-in, legacy roleless account) is auto-provisioned as a donor in `hooks/useAuth.jsx` — safe because the rules freeze `role`, so the write can never demote an existing hospital/admin document. Hospital accounts are made by the Dugo+ team; admins by editing the document. | FR-01, FR-012, FR-040 |
| D21 | **Partnership intake posts to Formspree** (`VITE_FORMSPREE_ENDPOINT`, email to the partners mailbox) — no Firestore collection for requests; hospital accounts are created by the team from those emails. The endpoint is a public form URL, committed in `web/.env.example`. | FR-012, FR-040 |
| D22 | **The `users/{uid}` shape is aligned to schema §2.1.** Renames: `name`→`fullName`, `contact.phone`→`phoneNumber`; the nested `location{coordinates,geohash,city,address}` becomes flat `latitude`/`longitude`/`geohash`/`city`; `address` is dropped (not collected). Added: `status` (`Active\|Suspended\|Removed`, default `Active`, admin-writable for FR-040) and optional `hospitalId`. `isVerified` is **not** stored — Firebase Auth owns email verification (D5). `scripts/backfill-users-shape.mjs` migrated the live collection on 2026-10-22 (12 documents, verified, re-run a no-op), and the temporary old-name fallbacks in `readProfile` are removed — one vocabulary for the profile. `status` and `hospitalId` are written but no screen reads them yet — enforcement of a suspended account waits on the admin donor-registry screen (F9/F10). | FR-04, FR-019, FR-040, NFR-11 |
| D23 | **`docs/firestore_schema.md` is the model of record, not a cap.** A builder may add a collection or field the design needs; the obligation is visibility, not permission — the addition is written into the schema and `docs/SCHEMA_CHANGELOG.md` in the same task, and a `D*` row is added when it departs from what the schema said or from the ERD. §0.1's "do not invent collections" is replaced accordingly, `[ADDED]` no longer means "Firestore mechanics only", and the framing is "model of record" rather than "single source of truth". A new collection always gets a `D*` row; a new field only when it contradicts something written. | NFR-11, closeout |
| D24 | **`bloodRequests` enums and `component`.** `status` is `urgent \| collecting \| matched \| fulfilled \| cancelled` (the ERD's `Active \| Suspended \| Removed` was a copy-paste error — §9); `urgencyLevel` is `urgent \| stat \| routine`. Both are the shipped `.chip[data-status]`/`.chip[data-priority]` tone codes, read off the fixtures rather than chosen — an earlier proposal of `matching` and `Critical \| Urgent \| Routine` was wrong on both counts. `component` is **added** (FK → `donationTypes/{id}`): the fixtures and the components list both carry it and the schema had no home for it. `urgent` appears in both enums deliberately. | FR-006, FR-030 |
| D25 | **`eligibilityInfo` is removed from the model of record.** The ERD's `eligibility_info` was an optional free-form map — no structure, no reader, no writer. Eligibility is **computed on read** from `dateOfBirth` and `lastDonationAt` (`utils/eligibility.js`, FR-031), and `firestore.rules` refuses a write containing an `eligibility` key — that guard's name is the key it blocks, not a field, so it keeps the name a client would try. If a screening record is ever needed it gets a purpose-designed field in that feature. | FR-031 |

## Functional Requirements — Account Management (Donor & Recipient)

| ID | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-01 | Register with personal details, blood type, contact info + email verification link | app-code | P1 | done | D5 gate, not an advisory link; D6 admins pass by construction; D7 no start over; D20 self-registration is donor-only (was donor + hospital), role picker removed | F1 | Register form + verification email on signup (`services/auth.js` `sendEmailVerification`), `/verify-email` screen (`pages/public/VerifyEmail.jsx`); personal details, blood type and contact are captured on `/donor/profile` (`pages/donor/Profile.jsx`, FR-04). `layout/RequireVerified.jsx` (mounted in `App.jsx` over `/donor/profile` and `/admin/*`) holds an unverified session on `/verify-email`; `Register.jsx`/`Login.jsx` route unverified sessions there. Mail delivery, link verification, the gate lifting, and resend all confirmed working on 2026-10-20 (see `docs/PHASES.md`). D20 (2026-10-22): `Register.jsx` writes `role: 'donor'` only; Google first sign-in and any missing profile are auto-provisioned as donor in `hooks/useAuth.jsx`. 2026-10-23: a profile-write failure logs the SDK error to `errorLogs` and the screen offers a reload (which re-runs auto-provision) instead of a sign-in link |
| FR-02 | Log in with credentials, maintain secure session | app-code | — | done | built as written | F1 | `pages/public/Login.jsx`, `hooks/useAuth.jsx` |
| FR-03 | Log out, ending the session | app-code | — | done | built as written | F1 | `hooks/useAuth.jsx`, `layout/AppShell.jsx` |
| FR-04 | Create/edit profile: blood type, location, DOB, eligibility | app-code + firestore-rules | P1 | done | built as written; eligibility derived, never self-declared; D14 freezes `lastDonationAt` for the owner; the stored shape is D22's aligned one (this row carried the pre-D22 vocabulary until 2026-10-22) | F1 | `/donor/profile` (`pages/donor/Profile.jsx`); `users/{uid}` holds `{role,fullName,email,phoneNumber,bloodType,dateOfBirth,latitude,longitude,geohash,city,hospitalId,status,lastDonationAt,updatedAt}` (`services/users.js` `readProfile`/`saveProfile`); rules freeze `role` and `lastDonationAt` and validate field types (`firestore.rules`) |

## Functional Requirements — Donor

| ID | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-005 | Browse blood requests filtered by compatibility + proximity (tiered radius, NFR-05) | app-code | P3 | not started | — | F4 | Planned: donor request-list screen |
| FR-006 | Accept/decline a request, status updates in real time | app-code | P3 | not started | — | F4 | Planned: donor request-list screen + live query |
| FR-007 | Emergency SMS + email to matched donors | app-code + cloud-function + external-service | P5 | not started | D3 pluggable provider; SMS needs keys | F7 | D3: pluggable provider, email first |
| FR-008 | Donation history: dates, locations, facilities | app-code | P3 | not started | — | F5 | Planned: donor history screen |
| FR-009 | View accumulated points and rewards | app-code | P3 | not started | — | F5 | Planned: donor rewards screen |
| FR-010 | Health tracker: eligibility status + next donation date | app-code | P3 | partial | F1 half derived on the profile; tracker screen in F5 | F1, F5 | Eligibility derived read-only from DOB + `lastDonationAt` (`utils/eligibility.js`), shown on `/donor/profile` with the next eligible date; the dedicated donor tracker screen is still to build |
| FR-023 | Precise geolocation of hospitals within donor radius on map | app-code | P3 | not started | D4 Leaflet + OSM, no API key | F4 | D4: Leaflet component |
| FR-024 | Block new Whole Blood donation until 56 days since last | app-code | P3 | not started | — | F8 | Eligibility engine (from confirmed donations) |
| FR-025 | Block new Platelet donation until 7 days | app-code | P3 | not started | — | F8 | Eligibility engine |
| FR-026 | Block new Plasma donation until 28 days | app-code | P3 | not started | — | F8 | Eligibility engine |
| FR-027 | Block new Double Red Cell donation until 112 days | app-code | P3 | not started | — | F8 | Eligibility engine |
| FR-028 | Show eligibility guidelines for the selected donation type before accepting a request | app-code | P3 | not started | — | F4 | Planned: accept-flow gate |
| FR-029 | Require acknowledgment checkbox before accepting | app-code | P3 | not started | — | F4 | Planned: accept-flow gate |
| FR-030 | Record acknowledgment date/time in request history | app-code + firestore-rules | P3 | not started | rules half landed: a donor may update only `responseStatus`, `guidelinesAcknowledged`, `acknowledgedAt` on their own match (schema §6); the F4 screen still writes it | F4 | Match/participation document — rules side: `firestore.rules` donorMatches block, asserted in `firestore.rules.test.mjs` |
| FR-036 | Auto-award reward points once hospital confirms donation | cloud-function | P4/P5 | not started | — | F8, F10 | Triggered by FR-033 confirmation |
| FR-038 | Obtain and record donor consent before hospital access to profile | app-code + firestore-rules | P3/P8 | not started | rules half: `donorConsents` is donor-create for themself, revoke sets `revokedAt` only, no delete ever (NFR-16 gate); the F4 consent prompt still writes it | F4, F11 | Consent collection + rules gate (NFR-16) — rules side: `firestore.rules` donorConsents block, asserted in `firestore.rules.test.mjs` |

## Functional Requirements — Recipient

| ID | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-011 | Submit a blood request: blood type, quantity, urgency, hospital location | app-code | P2 | not started | D1 recipient merged into donor | F3 | D1: served by donor account; planned request form |

## Functional Requirements — Hospital

| ID | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-012 | Hospital staff log in/out with role-based credentials | app-code | — | done | built as written; D20 hospital accounts are team-created (intake on `/partner`, D21), login unchanged | F1 | Hospital role + `Login.jsx` + `RequireRole.jsx`; `/partner` (`pages/public/Partner.jsx`) is the intake that leads to a hospital account |
| FR-013 | Edit/maintain hospital profile | app-code | P4 | not started | — | F6 | Planned: hospital settings screen |
| FR-014 | View total blood units collected over a period | app-code | P4 | not started | — | F6 | Planned: hospital dashboard |
| FR-015 | View hospital location on a map | app-code | P4 | not started | D4 Leaflet + OSM, no API key | F6 | D4: Leaflet |
| FR-016 | List active blood requests in their facility | app-code | P2 | not started | — | F3 | Planned: hospital requests screen |
| FR-017 | Create requests on behalf of recipients, route to matching donors | app-code | P2 | not started | — | F3 | Planned: hospital new-request form (routing → P5) |
| FR-018 | Manage hospital subscription plan | app-code + firestore-rules | P4 | not started | — | F6 | Planned: hospital billing screen |
| FR-020 | Check blood inventory levels + view donation history | app-code | P4 | not started | — | F6 | Planned: hospital inventory screen |
| FR-021 | Submit emergency requests by compatibility + proximity (tiered radius) | app-code + cloud-function | P2/P5 | not started | — | F3, F7 | Form in P2, matching in P5 |
| FR-031 | Route matched donors to hospital for final eligibility verification | app-code | P4 | not started | — | F8 | Screening workflow. The donor-facing half exists: eligibility is derived, never self-declared (`utils/eligibility.js`), and the profile states a facility confirms at the donation itself |
| FR-032 | Mark donor Cleared / Deferred / Rejected after screening | app-code | P4 | not started | — | F8 | Screening workflow |
| FR-033 | Update donation history only after staff confirms donation (interval basis) | app-code + cloud-function | P4 | not started | D14: `lastDonationAt` frozen for the owner (presence and value, create and update) — only F8's server transaction writes it; staff-side `donations` create path is open to the staff claim (schema §6) | F8 | Confirmation action feeds FR-024–027 — rules side: `firestore.rules` users + donations blocks, freeze asserted in `firestore.rules.test.mjs` |
| FR-034 | Add/update blood inventory after donation or transfusion | app-code + firestore-rules | P4 | not started | rules half: `inventory` writes open to staff-of-that-hospital or admin claim, `logs` append-only (update/delete denied); the F6 screen still writes it | F6 | Planned: hospital inventory screen — rules side: `firestore.rules` hospitals/inventory + logs blocks, asserted in `firestore.rules.test.mjs` |

## Functional Requirements — System Administration

| ID | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-040 | Create hospital accounts; suspend/remove hospital + donor accounts (self-registration stays per FR-01) | app-code + firestore-rules | P6 | partial | D1 recipient merged into donor; D20 self-registration is donor-only — hospital accounts are created by the team from `/partner` requests (D21, Formspree → partners mailbox) | F9 | Admin role gate exists (`RequireRole`); no account-management UI. Intake: `/partner` (`pages/public/Partner.jsx`) — account creation itself still manual |
| FR-041 | Configure system parameters: tiered radius, notification retry | app-code + cloud-function | P5/P6 | not started | — | F7, F9 | Settings screen in P6 reads by matcher in P5 |
| FR-046 | Admin log in/out with role-based credentials | app-code | — | done | built as written | F1 | `Login.jsx`, `RequireRole` `roles={['admin']}`, `App.jsx` |
| FR-047 | Admin views own account profile | app-code | P6 | partial | no profile page; the sidebar shows the signed-in name only | F9 | `AppShell` sidebar (`#sidebar-signed-in`); the page itself is not built |

## Functional Requirements — System Wide / Cross Cutting

| ID | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-019 | Access controls + encryption for donor/recipient data (RA 10173) | firestore-rules + ops-config + compliance-doc | P1/P8 | partial | D15 claims-based RBAC (`request.auth.token.role`) written across all 15 collections; D16 `users` keeps the built shape, not schema §2.1; D17 `errorLogs` open-create. Admin/staff paths are inert until custom claims exist (PHASES §10); the encryption/compliance half is untouched | F9 | `firestore.rules` (all 15 collections + server-only blocks + catch-all deny), `firestore.rules.test.mjs` (106 emulator asserts), CI `rules` job (D19, `.github/workflows/checks.yml`) |
| FR-022 | Show precise geolocation of donors and recipients after a match | app-code | P4 | not started | D4 Leaflet + OSM, no API key | F4 | D4: Leaflet, post-match view |
| FR-035 | Authorized users view blockchain-based audit log | app-code + cloud-function | P7 | not started | D2 hash chain, not a real blockchain | F10 | D2: hash-chain viewer |
| FR-037 | Prioritize higher-urgency requests in matching queue + hospital list | app-code | P2/P5 | not started | — | F3, F7 | Sort order in hospital list (P2) and matcher (P5) |
| FR-039 | Users submit access/correct/delete data requests; admin processes them | app-code + firestore-rules | P6 | not started | — | F9 | Data-request queue |
| FR-042 | Commit a blockchain record for every donation confirmation, inventory update, data-access event, at action time | cloud-function | P7 | not started | D2 hash chain, not a real blockchain | F10 | D2 |
| FR-043 | Committed records unmodifiable; corrections append as linked entries | firestore-rules + cloud-function | P7 | not started | D2 hash chain, not a real blockchain | F10 | D2 |
| FR-044 | Admin verifies a record's hash against the chain | app-code + cloud-function | P7 | not started | D2 hash chain, not a real blockchain | F10 | D2: verify walk |
| FR-045 | Chain stores only hashed/non-identifying refs so PII deletion still works | cloud-function + firestore-rules | P7 | not started | D2 hash chain, not a real blockchain | F10 | D2 |
| FR-048 | Donors/Recipients/Hospital reset password via verified channel; admins excluded (premade accounts) | app-code | P1 | done | admins excluded by decision (console-created accounts) | F1 | `/forgot-password` (`pages/public/ForgotPassword.jsx`) + `sendPasswordReset` (`services/auth.js`); linked from `/login`; generic confirmation so no account is revealed |

## Non-Functional Requirements

| ID | Category | Requirement | Class | Phase | Status | Notes | Feature | Where / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-01 | Performance | Match request to eligible nearby donors within 3s | cloud-function | P5 | not started | — | F7 | Matcher timing instrumentation |
| NFR-02 | Performance | SMS/email to matched donors within 3s of a match | cloud-function + external-service | P5 | not started | D3 pluggable provider; SMS needs keys | F7 | D3 fan-out timing |
| NFR-03 | Performance | Support ≥500 concurrent users without noticeable degradation | ops-config + app-code | P9 | not started | — | F12 | Load test evidence (k6/artillery) |
| NFR-04 | Performance | Donor dashboard, request list, hospital dashboard load ≤3s | app-code | P9 | not started | — | F12 | Measured timings |
| NFR-05 | Performance | Tiered radius matcher (5→10→15→20–25 km), search <5s | cloud-function | P5 | partial | D4 Leaflet + OSM, no API key | F7 | Geohash encoding and storage done (`utils/geohash.js`, `location.geohash` on `users/{uid}`); the tiered-radius query + timing is still to build |
| NFR-06 | Reliability | 99.5% availability | ops-config | P9 | not started | — | F12 | Hosting SLA + uptime check evidence |
| NFR-07 | Reliability | Keep request active; retry notification on SMS/email failure | cloud-function | P5 | not started | D3 pluggable provider; SMS needs keys | F7 | Retry queue in fan-out |
| NFR-08a | Reliability | Automated backups of all data to cloud storage | ops-config | P9 | not started | — | F12 | Scheduled Firestore export |
| NFR-08b | Reliability | Full backup ≥ every 24h; active requests/matches in real time | ops-config | P9 | not started | — | F12 | Daily export + PITR/real-time story |
| NFR-09 | Reliability | Handle third-party outages (SMS/email/GPS) and inform the user | app-code + cloud-function | P5 | not started | D3 pluggable provider; SMS needs keys | F7 | D3 unavailable-state messaging |
| NFR-10 | Security | Encrypt sensitive data at rest and in transit | ops-config + compliance-doc | P8 | not started | D11 HTTPS in transit via Hosting; at-rest still console-verified | F11 | Firestore default at-rest encryption to be confirmed in console and written up |
| NFR-11 | Security | Restrict donor data to authorized hospital users + admin (RBAC) | firestore-rules | P1/P8 | partial | D15: admin/staff access keyed on custom claims (outstanding, PHASES §10); per-collection reads are donor-own / staff-of-hospital / admin; `users` read stays owner+admin (D16) | F9, F12 | `firestore.rules` — `donorMatches`, `donorConsents`, `donations`, `rewardTransactions`, `hospitals/*` all gate on ownership or `isStaffOf(hospitalId)`; `firestore.rules.test.mjs` asserts each boundary in the emulator |
| NFR-12 | Security | Email verification on registration | app-code | P1 | done | D5 gate, not an advisory link; D6 admins pass by construction; D7 no start over | F2 | `sendEmailVerification` in `signUp` (`services/auth.js`); `/verify-email` re-reads the user via `reloadCurrentUser` and forwards once verified. `layout/RequireVerified.jsx` holds an unverified session on `/verify-email`. Mail delivery, link verification, the gate lifting, and resend all confirmed working on 2026-10-20 (see `docs/PHASES.md`) |
| NFR-13 | Security | Password ≥8 characters with complexity | app-code + ops-config | P1 | done | stricter than the original letter + digit check: server policy `ENFORCE`, min 8, upper + lower + numeric; the email-equality check stays client-side; `forceUpgradeOnSignin` off so existing accounts keep their passwords until reset | F2 | `utils/password.js` `passwordProblem` (8+, upper + lower + numeric, not the email) and `Register.jsx`; Identity Platform password policy `ENFORCE` on `dugo-plus` (configured 2026-10-23; the reset flow uses the same policy) |
| NFR-14 | Security | End session after inactivity | app-code | P1 | not started | D9 deferred, descoped not dropped | F12 | **Deferred by D9** — idle timer → signOut; restated each session until answered, withdrawn, or cancelled |
| NFR-15 | Security | Tamper-evident blockchain-based audit trail | cloud-function + firestore-rules | P7 | not started | D2 hash chain, not a real blockchain | F10 | D2 hash chain |
| NFR-16 | Security | Donor consent before hospital access to donor information | app-code + firestore-rules | P3/P8 | not started | — | F4, F11 | FR-038 consent + rules gate |
| NFR-17 | Compliance | Data Privacy Act of 2012 (RA 10173) compliance | compliance-doc + app-code | P8 | not started | — | F11 | Consent/privacy copy + data rights flows |
| NFR-18 | Compliance | DOH AO 2020-0030 health-data privacy guidelines | compliance-doc | P8 | not started | — | F11 | Privacy copy + handling rules |
| NFR-19 | Compliance | Mechanism to request access/correction/deletion of personal data | app-code | P6/P8 | not started | — | F9, F11 | FR-039 flow |
| NFR-20 | Usability | Simple/intuitive for first-time users with low technical literacy | app-code | P9 | partial | stricter than spec on auth copy; full usability audit pending | F12 | Auth card restructured (`/login`): clearer subline, in-field password reveal, and a footer note stating hospital/admin accounts are team-provided — usability pass still pending |
| NFR-21 | Usability | Clear, immediate error messages in plain language | app-code | P9 | partial | sign-in cannot separate unknown-email from wrong-password (enumeration protection on) | F12 | Auth errors mapped per field (`services/auth.js` `ERROR_INFO` + `authErrorDetail`); all forms check every field on submit and render each message under its input (`utils/validate.js`, `components/FieldError.jsx`, applied to Login/Register/ForgotPassword/VerifyEmail); `aria-invalid` + `aria-describedby` + `role="alert"`. Finding: `dugo-plus` has email-enumeration protection on, so sign-in collapses unknown-email and wrong-password to `auth/invalid-credential` (verified live) — the undistinguishable case shows a card-level message rather than blaming a field. Full-screen audit still pending |
| NFR-22 | Usability | Low-connectivity support with clear messaging | app-code | P5/P9 | not started | — | F12 | Offline/error states |
| NFR-23 | Usability | Hospital dashboard scannable for time-pressured staff | app-code | P4 | not started | — | F6, F12 | Hospital dashboard layout |
| NFR-24 | Scalability | Expand to more hospitals/areas without redesigning matcher | cloud-function + compliance-doc | P9 | not started | — | F12 | Architecture note + load evidence |
| NFR-25 | Scalability | Donor database grows without significant performance loss | ops-config + app-code | P9 | not started | — | F12 | Indexes + load evidence |
| NFR-26 | Maintainability | Modular architecture, features updatable independently | app-code | P9 | partial | layered `web/src/` layout; evidence write-up pending | F12 | Layered `web/src/` layout exists; evidence write-up pending |
| NFR-27 | Maintainability | Log system errors and exceptions | app-code | P1 | done | D8 client-written; D10 create-only rules; auth and mail failures logged, form-level user errors stay user-facing; `createdAt` must be the server timestamp | F2 | Client-written to `errorLogs` via `services/log.js` (`errorRecord`+`logError`), `layout/ErrorBoundary.jsx`, global `error`/`unhandledrejection` hooks, and the `services/auth.js` auth/mail catches (including the `useAuth` profile-write catches); all six fields required, size capped, and `createdAt == request.time` in `firestore.rules`; 106 rules asserts. No Cloud Function required. |
| NFR-28 | Compatibility | Donor/Recipient access via Android/iOS mobile web | app-code | P9 | partial | responsive system exists; verification pass pending | F12 | Responsive design system; verification pass pending |
| NFR-29 | Compatibility | Hospital/Admin access via browser dashboard | app-code | P9 | partial | `AppShell` desktop layout; verification pass pending | F12 | `AppShell` desktop layout; verification pass pending |

## Closeout criteria (P10)

- [ ] Every row Status = `done` with a Where/evidence entry that points at real files or run results.
- [ ] Every non-`app-code` class row has its external/config/compliance evidence recorded (console config, provider keys, load-test run, policy text).
- [ ] `prod` is fast-forwarded to `main`, `tools/deploy.sh` run from `prod`, and the deployed site at `dugo-plus.web.app` loads and signs in.
- [ ] `cd web && npx vite build` passes.
- [ ] README updated to describe the shipped system.
