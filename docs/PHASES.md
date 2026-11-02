# Phases and how to continue them

Handoff document for the Dugo+ build. Read `AGENTS.md` first (it holds the repo
rules), then this, then `docs/REQUIREMENTS.md` (the FR/NFR table, which is the
single source of truth for status).

This file says **how the work is organised and how to pick it up**. It does not
copy requirement rows: it refers to them by ID, so the table stays the only place
status lives and the two files cannot drift apart.

---

## 1. What this is

Dugo+ is a blood-donation platform built as a final project. It is a working
product, not a documentation exercise: a requirement row is `done` when the flow
works for a real user, not when the code exists. The traceability table is how
that is proved.

Only **P1** has shipped work. Everything from P2 on is open.

## 2. Status at a glance

Counts come from `docs/REQUIREMENTS.md`; check that file for the authoritative
numbers rather than trusting this section.

| Phase | Covers | Status |
| --- | --- | --- |
| **P1** | Auth, accounts, profile, error logging | **mostly done**. Done: FR-01, FR-02, FR-03, FR-04, FR-48, NFR-12, NFR-13, NFR-27 done; NFR-14 deferred |
| **P2** | Blood request submission and listing | in progress (F3: hospital posts, lists, and manages its requests; smoke pending) |
| **P3** | Donor browse, respond, history and health tracker | partial (F4 donor requests/respond/map built; D42 requests/alerts redesign and single-commitment service built; D49 requires a complete donor profile before acceptance; F5 history/tracker at `/donor/activity`; rewards removed by D43; coordinated rollout pending. FR-024–027 component intervals remain in the eligibility engine; the deferral clock is written by the staff confirmation, D51) |
| **P4** | Hospital dashboard, inventory, screening | partial (FR-013 facility profile, FR-014 blood units collected over period, FR-018 partnership plan (D28), FR-020 inventory reads + donation history, initial dashboard shell + FR-015 hospital map, FR-034 writes as client transactions (D27), FR-033 clock write (D51), FR-031/FR-032 screening routing and marking, D37 request-queue redesign (NFR-23); reward points wait for a server path — see §10) |
| **P5** | Matching and notifications | in progress (F7 Part 1+2); needs Cloudflare Worker (free) + optional Brevo |
| **P6** | Admin account management, data-request queue | partial (F9: FR-047 profile page; suspension/removal gate + `/admin/accounts` with hospital creation + `/admin/settings` + `/admin/data-requests` + `/donor/privacy` + `/privacy` + required registration consent recorded on the profile, built and building clean; D40: versioned Worker account operations, durable audit outbox and owned provisioning recovery built; 181 rules checks, 64 unit/regression tests and four REST-emulator tests pass locally; coordinated deployment/live-provider smoke pending; functions not deployed, no signed-in smoke here) |
| **P7** | Hash-chain audit trail | in progress (F10a/F10b; D40 account/erasure outbox and erasable context verified locally; other DSR hooks remain best-effort; donation/inventory events wait on F8/F6) |
| **P8** | Compliance and privacy | not started; mostly documents |
| **P9** | Non-functional hardening (responsiveness, scale, compatibility) | in progress (D35: responsive care redesign inspected with fixture data; live/mobile-device and performance verification remain) |

Phase numbers order the table. They are not a build order and not a work
assignment: see §5.

## 3. Pick up a phase

For any phase:

1. Open `docs/REQUIREMENTS.md` and read its rows. The **Class** column says what
   kind of work each row needs.
2. Open `docs/firestore_schema.md` and read the collection(s) that row touches
   (§2 for fields and enums, §5 for what must be a transaction, §6 for the rules
   path, §4 for an index). Its §0 lists where the shipped build deliberately
   differs — that table wins over the section text.
3. Anything whose Class is not `app-code` needs work outside the React app.
   `cloud-function` rows cannot be finished from frontend code (see §7).
4. Build the smallest thing that makes a row genuinely work, then update that
   row in the same task.
5. Verify against §8 before calling it done.

### P1 in detail, since it is the one with history

- **Done:** registration and sign-in (email/password and Google), sign-out, the
  three account types (`donor | hospital | admin`), the donor profile with blood
  type, date of birth, contact and location, eligibility derived on read, email
  verification as a route gate, password reset, and the password policy.
- **Decisions that shape it:** D5 (verification is a gate, not a link), D6
  (admins pass by construction), D7 (no "start over"), D9 (NFR-14 deferred),
  D8/D10 (error logging split, client-written).
- **Confirmed working:** the whole verification loop was exercised by hand on
  2026-10-20: mail delivered, the link verified, the gate lifted, resend worked.
- **Still open in P1:** NFR-14 (idle session timeout, deferred).

## 4. The feature list

Every requirement row in `docs/REQUIREMENTS.md` carries a **Feature** column
naming the feature that completes it, or features, where a row is finished across
several. This is that list. A feature is the unit of work: one person, taken to
working.

Rows also carry a **Notes** column, holding the deviation or change for that row
(a `D*` reference, a descope, stricter or looser than spec). It is required once
a row reaches `done` or `partial`, and it is the one place a decision is stated:
Where/evidence points at files, it does not repeat the decision.

| ID | Feature | Phase(s) | Rows |
| --- | --- | --- | --- |
| F1 | Donor and hospital account, profile, sign-in | P1 | FR-01, FR-02, FR-03, FR-04, FR-012, FR-046, FR-048 |
| F2 | Auth hardening: verification gate, password policy, error logging | P1 | NFR-12, NFR-13, NFR-27 |
| F3 | Hospital posts and manages blood requests | P2 | FR-011, FR-016, FR-017, FR-037 (list half), FR-021 (form half) |
| F4 | Donor browses and responds to compatible requests | P3 | FR-005, FR-006, FR-028, FR-029, FR-030, FR-022, FR-023, FR-038 (collect half) |
| F5 | Donor history and health tracker (rewards descoped D43) | P3 | FR-008, FR-009, FR-010 |
| F6 | Hospital dashboard, inventory and map | P4 | FR-013, FR-014, FR-015, FR-018, FR-020, FR-034 |
| F7 | Matching and notifications | P5 | FR-007, FR-021 (matcher half), FR-037 (queue half), FR-041 (reader half), NFR-01, NFR-02, NFR-05, NFR-07, NFR-09 |
| F8 | Donor screening and donation confirmation | P4 | FR-024, FR-025, FR-026, FR-027, FR-031, FR-032, FR-033, FR-036 |
| F9 | Admin account management and data requests | P6 | FR-019, FR-039, FR-040, FR-041 (settings half), FR-047 |
| F10 | Hash-chain audit trail | P7 | FR-035, FR-042, FR-043, FR-044, FR-045, NFR-15 |
| F11 | Compliance and privacy | P8 | FR-038 (consent half), NFR-10, NFR-16, NFR-17, NFR-18, NFR-19 (process half) |
| F12 | Non-functional hardening | P9 | NFR-03, NFR-04, NFR-06, NFR-08a, NFR-08b, NFR-11, NFR-14, NFR-20, NFR-21, NFR-22, NFR-23, NFR-24, NFR-25, NFR-26, NFR-28, NFR-29 |

Rows finished across more than one feature name both, for example FR-037 is
F3 (the hospital list sorts by urgency) and F7 (the matcher queues by urgency),
and FR-010 is F1 (shown on the profile today) and F5 (its own tracker screen).

F1 and F2 are built. Everything else is open. Row-level status stays in
`docs/REQUIREMENTS.md`; this table is who finishes what, not what is done.

## 5. How the work is split

### Write-back

A task is not complete until three things are updated in the same commit:

| File | What |
| --- | --- |
| `docs/REQUIREMENTS.md` | the row(s) it moved: Status, Notes, Where/evidence |
| `docs/PHASES.md` §2 | the phase's status line, if a count changed |
| `docs/PHASES.md` §10 | any open question raised, and any answered |

A Firestore change also updates `docs/firestore_schema.md` when it moves the
model itself (a new collection or field), or records the difference as a `D*` row
when it deliberately departs from it. Schema §9's own open questions are handled
the same way as §10's: answered by an owner, recorded as a `D*` row, and
re-stated until then — never resolved by an assumption.

`node tools/check-docs.mjs` enforces the table half of this: a missing Feature,
an `F*` or `D*` reference that does not resolve, or a `done`/`partial` row with
no Notes fails the check. Tracking stays honest because skipping it fails
loudly rather than passing silently.

**One feature, one person, taken all the way to working.** Not one layer per
person, and not one phase per person.

The reason is the one that matters in practice: a horizontal split (person A
writes the data function, person B writes the screen) means B waits on A, and
neither can say a feature works until both are done. Splitting vertically means
each person owns the data call and the screen that uses it, so there is no
handoff and no waiting. It also removes the main integration risk, since the
person who writes a function is the person calling it.

### Dependencies: stub, do not wait

When a feature needs something unbuilt, put a stub behind the existing service
seam and carry on. The seam is `web/src/services/`; pages never call the
Firebase SDK directly, so a stub is a small change in one file.

```js
// services/notify.js. P5 replaces this with the real matcher and provider.
export async function routeToMatchingDonors(requestId) {
  console.info('[stub] matching not built', requestId)
}
```

Stubs are for genuinely external or unbuilt work (SMS, Cloud Functions, the
matcher). A stub is **not** acceptable for a flow a user walks through: if a user
can click it, it has to work.

### Worked examples

Three of the open features in full, showing the size a single person should take.

**F3. A hospital posts a blood request.** P2: FR-011, FR-016, FR-017, and the
hospital half of FR-037.
Builds `pages/hospital/Requests.jsx` and `pages/hospital/NewRequest.jsx`, the
`createRequest()` / `listHospitalRequests()` pair in `services/requests.js`, and
the `requests/*` rules. The routing half of FR-021 is stubbed (P5).
*Done when:* a hospital can post a request, reload, and still see it.

**F4. A donor sees and accepts a compatible request.** P3: FR-005, FR-006,
FR-028, FR-029, FR-030.
Builds `pages/donor/Requests.jsx`, a compatibility helper, the
eligibility-before-accepting gate, and the acknowledgment record.
*Done when:* a matching donor sees the request, a non-matching donor does not,
and someone inside their donation interval is blocked with a reason.

**F9. An admin manages accounts.** P6: FR-040, FR-047, part of FR-039.
Builds `pages/admin/Accounts.jsx` and `pages/admin/Profile.jsx`, plus cross-user
reads and a status write in `services/users.js`.
This is the feature that **widens the rules**: `users/*` is owner-read only
today, and an admin listing every account needs a rule change, and a suspension
has to hold somewhere the client cannot bypass (NFR-11).
*Done when:* a suspended account is genuinely blocked, not just hidden in the UI.

Four of five people can start on features like these immediately, because they
touch different files. The exception is anything in P5/P7, which needs Cloud
Functions before it can be finished.

### Files that collide

Ownership is by feature, but three files are touched by nearly every feature and
should have **one writer at a time** (rotate by week, or let whoever merges first
take the next edit):

| File | Why it collides |
| --- | --- |
| `web/src/App.jsx` | every new route |
| `firestore.rules` | every new collection |
| `docs/REQUIREMENTS.md` | every completed row |

`web/src/styles/app.css` and `web/src/components/index.js` collide less often but
are worth the same treatment while several features are in flight.

### Branches

Five branches. Only three matter for day-to-day work.

| Branch | Role | Who writes to it |
| --- | --- | --- |
| `main` | release truth. Always builds. Only receives `integration`. | nobody directly; merges come from `integration` |
| `integration` | the collect branch. Feature branches merge here via PR, and it is merged into `main` when it is known good. | feature owners, via PR |
| `feat/*` | one per feature, cut from `integration` | the feature owner |
| `prod` | **release mirror**, only ever fast-forwarded from `main` | nobody directly |
| `staging` | the owner's personal experiment branch, where unrelated ideas are tried together. An unrelated root to `main`; never merged. | the owner only |

**The flow for a feature:**

```
integration ──> feat/<feature> ──PR──> integration ──PR──> main
                (you build here)      (owner reviews)   (owner merges)
```

```bash
git checkout integration && git pull
git checkout -b feat/hospital-requests
# ...build, run the build and check-docs...
git push -u origin feat/hospital-requests
# open the PR against integration
```

Branch `feat/*` off `integration`, not off `main`. Both would work, but branching
off `integration` means your work is built on top of whatever else is already
collected, so it integrates before it is reviewed rather than after.

**`integration` has to be kept rebased on `main`.** This is the one thing Option
B costs: if `main` moves and `integration` does not, every feature merged into
`integration` is built on stale ground and the eventual merge back is a conflict
pile. Merge `integration` into `main` often rather than saving it up.

```bash
git checkout integration
git pull --rebase origin main
git push
```

Both `main` and `integration` are protected: they require a pull request, a
passing `checks` run, and an up-to-date branch. Feature branches are not
protected, since only their owner works on them.

Shipping is manual, and deliberately so: the decision to put something live
should be a decision, not a side effect of a merge.

```bash
git checkout main && git pull
git checkout prod && git merge --ff-only main && git push
```

`--ff-only` is not decoration: it makes the command fail loudly if `prod` has
drifted, instead of quietly creating a merge commit that hides the problem.

**`staging` note:** it is deliberately unrelated to `main` and is never merged
into it. Code that proves out there graduates by cherry-pick or by copying the
change across, not by merging the branch. Nothing on `staging` is expected to
appear in `docs/REQUIREMENTS.md`; that table tracks `main`.

## 6. Guardrails

- **`main` must build.** `cd web && npx vite build`, then
  `node tools/check-docs.mjs`. Both run in CI on every PR
  (`.github/workflows/checks.yml`), so a green PR means both passed.
- **One requirement row per PR, updated in that PR.** A PR that changes behaviour
  covered by a row, without updating the row (Status, Notes, Where/evidence), is
  incomplete.
- **Nobody commits to `prod`.** It mirrors `main` or it is wrong.
- **Daily rebase.** `git pull --rebase origin integration` each morning while
  your branch is open. Conflicts found hours after they appear are minutes of
  work; found days later, they are hours.
- **The build catches signature changes, not behaviour changes.** Renaming an
  export or removing an import fails the build. Changing what a function *means*
  while keeping its signature does not, and that is the failure mode to watch
  when two people are working near each other.

### Smoke list

There is no test suite. Until there is, run these four checks by hand before
merging anything that touches `services/`, `lib/`, or `firestore.rules`:

1. Sign in with email/password → lands on `/home`.
2. Reload `/home` → saved values appear (proves reads still work).
3. Change a field, save, reload → the change persisted (proves writes still work).
4. Sign out, sign in as an unverified account → still held at `/verify-email`
   (proves the gate survived).

**This is a stopgap, not a safety net.** A test suite (vitest plus React Testing
Library) would cover this class of breakage automatically on every PR. That work
is not scoped or scheduled; it is recorded here so the smoke list is not mistaken
for the real thing.

A screen-by-screen pass — every route and gate, the states each screen must
carry, and the security-boundary suite — is in `docs/SMOKE_TESTS.md`. Run that
before a release or a PR that touches shared code.

## 7. What needs work outside the app

Some rows cannot be finished from `web/src`. Do not mark them `done` from
frontend code alone.

| Needs | Rows (examples) | Requirement outside the app |
| --- | --- | --- |
| Cloud Functions | FR-007, FR-021, FR-036, FR-041, FR-042-045 | **the Blaze plan**: Functions cannot be deployed on Spark |
| Account service host | FR-040 | a free Node host account (Vercel/Netlify) holding the service-account key in its environment — the D33 alternative to Blaze for account creation |
| SMS / email provider keys | FR-007, NFR-02, NFR-07, NFR-09 | a paid provider account |
| Firebase console / ops | NFR-08, NFR-10, NFR-25 | project configuration |
| Written policy | NFR-17, NFR-18 | compliance text |

## 8. Verifying a change

Before calling a screen finished, from `AGENTS.md`:

- **Hierarchy**, the eye lands somewhere, and it is the right place.
- **Spacing rhythm**, deliberate and consistent, not default browser gaps.
- **States**, empty, loading, error, disabled and focus, not only the happy path.
- **Would this look at home on a good production site?** Matching the mockups is
  not the bar.
- **Both themes**, light and dark, off the tokens. `/gallery` renders every
  component in both.
- **Build**, `cd web && npx vite build` passes.
- **Compiled output**, anything claimed about CSS values, routes or icons is
  confirmed in `dist`, not only in source.

Deploying is covered in `docs/DEPLOY.md`.

## 9. Setup on a new machine

```bash
git clone https://github.com/Airiquo/dugo-plus.git
cd dugo-plus
cp web/.env.example web/.env.local   # then fill in the six VITE_FIREBASE_* values
cd web && npm install
npm run dev                          # http://localhost:5173
```

Firebase CLI, for rules and deploys:

```bash
npm install -g firebase-tools
firebase login
firebase use dugo-plus
```

The app does not run unconfigured: with any `VITE_FIREBASE_*` missing, every
route renders `pages/shared/NotConfigured`.

## 10. Open questions

- **Donor alert count placement (2026-11-02, D44).** Owner asks to remove the decorative alert bell/count from the Alerts hero and put the unread count on the shared Alerts navigation icon. The shared nav now listens to live alerts on donor screens; inbox-level context and unread/read filters remain. No schema or phase-count changes. Verification is recorded in `docs/DONOR_EXPERIENCE.md`.

- **Activity and lifeline visual refresh (2026-11-02).** Owner requests the full Activity redesign and a stronger visual beside “Your blood type. Someone’s lifeline.” Activity now uses a yearly visit timeline with expandable details, search/type filters, summary and readiness panel; the shared token-based blood-drop/lifeline SVG appears in Activity and Requests. No new data fields or eligibility rules are introduced; phase counts are unchanged. Build/docs and five responsive widths in both themes pass; fixture checks cover loading/empty/error/deferred states. Owner-requested expanded live fixtures include multi-year history plus empty, deferred and unverified donors; existing commitments are preserved. Verification is recorded in `docs/DONOR_EXPERIENCE.md`.

- **Donor workflow overhaul (2026-11-02, D42/D43).** Owner requests one active acceptance, redesigned Requests/Alerts, more request detail, rewards removal, compass/expand icon controls, and aligned dropdown carets. Those design/product choices are resolved. Worker and security-rules production rollout remains separate from local implementation; local trusted API runs on 8788. Build/docs, 76 regression tests, 2 photo tests, 212 rules checks, 4 donor REST tests and 4 account REST tests pass; browser auth/profile and responsive/interaction checks pass. Verification is recorded in `docs/DONOR_EXPERIENCE.md`.

- **F4/F5/map integration (2026-11-02).** Owner requests a separate branch from integration combining F4, F5 and `fix/f4_map`. F4 is already an ancestor; conflicts retain the current auth, account, navigation and redesign work while adding activity/history/rewards and map fixes. D41 records F5 points-only scope without replacing D26. Build/docs, 67 regression tests, 2 photo tests, 207 rules checks, 4 REST transaction tests and actual-app emulator smoke pass; production smoke remains pending. Results are recorded in `docs/F4_F5_INTEGRATION.md`; no deployment is requested.
- **Admin batch 2 (2026-11-02, D50).** Owner resumes in a separate worktree on `feat/admin-accounts-ui`, using Conventional Commits and no codex prefix. This batch implements Accounts and its account-history overlay against the D40 v2 mutation service; the global Audit Trail and remaining admin screen compositions stay in later batches. The history index/Worker endpoint must be deployed by the authorized owner before frontend history can work. Local verification and rollout limits are in `docs/ADMIN_ACCOUNTS_WORKSPACE.md`; no live deployment or account mutation is included. Phase status counts are unchanged.

- **Profile pictures (2026-11-01, D39).** Owner requests Cloudinary pictures for all three account types in a separate worktree and supplies cloud `dmecmkdww` / preset `dugo-plus-profiles`; the owner enables Unsigned after the first provider rejection, and a tiny generated test icon then uploads successfully. No provider configuration question remains. Removal/replacement/erasure clear only the profile URL; support must delete retained Cloudinary assets. No deployment is included. Verification and the retained test asset are recorded in `docs/PROFILE_PICTURES.md`. Phase counts are unchanged.
- **Donor card photo placement (2026-11-02, D45).** The saved donor picture is enlarged within a circular dotted ring with a narrow gap and no white frame; name and a compact blood-type card appear below it. Missing or broken pictures use initials. No open question or phase-count change.

- **Donor profile and request safeguards (2026-11-02, D46–D49).** Owner confirms that tapping Use my location may send an approximate point to OpenStreetMap to fill the existing City field; no separate address is wanted. D46 adds the authenticated configurable lookup, city-edit protection, attribution and approximate-point cache. D47 makes Deferred red in request details. D48 locks blood type and date of birth after a confirmation overlay and first save; admins retain corrections. D49 requires name, blood type, date of birth and city to accept; phone/GPS stay optional, and the UI plus Worker enforce the gate. No phase counts change. Verification is recorded in `docs/DONOR_EXPERIENCE.md`.

Stated every session until answered, explicitly withdrawn, or the work they block
is cancelled. An assumption is never recorded in place of an answer.

- **Admin batch 1 authorized (2026-11-01, D40).** Owner approves separate feature/fix branches with descriptive Conventional Commits and no codex prefix. Account mutations now use a versioned server operation, durable audit outbox, owned provisioning recovery, permanent-login state and erasable context records. UI redesign remains in later batches. Local validation and coordinated deployment order are in `docs/ADMIN_ACCOUNT_OPERATIONS.md`; production Worker authentication/provider smoke and deployment remain pending. No compliance or donation/inventory requirement is closed by this batch.

- **Requested remote commit imported (2026-11-01).** Owner requests cherry-picking `9698690dad74cca900406bd465aec868b357f1a3` from `origin/feat/f3-f4-f7-f9-f10` onto integration. Its Cloudflare account-service decision is D38 here because D35 already identifies the care redesign. Import preserves that redesign, D36 build/cache work and D37 hospital queue. Validation is build/docs/unit tests and Worker dry-run bundling; live privileged account operations and Worker deployment remain outside this cherry-pick verification.
- **Hospital table and release direction resolved (2026-11-01, D37).** Owner authorizes the request-table UX redesign and directs deploying from integration for now. Feature PRs still require checks; the clean merged integration commit is the temporary Hosting source. Table path/recovery checks use isolated fixtures; real staff credentials/persistence verification remain unavailable. See `docs/HOSPITAL_REQUEST_QUEUE.md`.
- **Hosting cache/build identity authorized (2026-11-01, D36).** Owner requests the fix on `fix/registration-single-writer`, PR/merge into integration and a Hosting-only redeploy. Header policy and build stamp are implemented; `tools/verify-hosting-build.mjs` checks the deployed HTML/JS bytes and cache headers after release. Real signup verification is pending owner credential/consent/email interaction; the pasted existing-account claim is not evidence of a completed smoke test.
- **Design direction resolved (2026-11-01, D35).** Owner requests the approved landing design across the app, light default and donor desktop/mobile responsiveness; free redesign is authorized. Contextual auth headings replace the role-count line, and bounded centered gutters correct its left stretch. No further design question is blocking this branch. See `docs/CARE_REDESIGN.md` for verification scope.
- **NFR-14, idle session timeout**: deferred (D9). No timeout value, no policy
  on what counts as activity, no decision on whether it applies to all roles.
- **`firestore.rules` + `firestore.indexes.json` deployed 2026-10-21.** The
  15-collection ruleset went live after the owner reviewed the diff
  (`firebase deploy --only firestore:rules,firestore:indexes --project
  dugo-plus`; rules released, 12 composite indexes confirmed live via
  `firebase firestore:indexes`). The follow-up commit fixed two deploy gaps
  found during it: `firebase.json` did not declare the `indexes` path, so the
  CLI skipped index deployment silently, and the collection-group `logs` index
  was rejected by the API as unnecessary (single-field CG queries use the
  automatic index). **`npm run seed` ran 2026-10-22** against the live
  `dugo-plus` project (9 docs: 4 donation types, 4 guidelines, `systemConfig/
  global` with the D18 5-tier radius ladder), via the service-account key kept
  outside the repo at `~/.config/dugo-plus/sa-key.json`. The key is **kept for
  the `users` backfill** (`scripts/backfill-users-shape.mjs`, D22) and deleted
  from disk with its console access revoked once that has run and the
  read-time fallbacks are out.
  **Corrected 2026-11-01:** the live rules release is `2026-11-01T05:46Z`
  (ruleset `3e42ba9f`, consent freeze included), and hosting had not been
  released since **2026-10-20** until the 2026-11-01 integration deploy, which
  was the first production build carrying D20/D28.
- **The `users` backfill has not run on the live project.** `npm run
  backfill:users` (dry by default; `--apply` writes) must run once before the
  fallbacks in `readProfile` are removed. Until then the app reads either shape
  correctly, so a missed document degrades to an empty field rather than an
  error.
- **Custom claims published 2026-11-02** (D15, D26/A1), resolving the earlier
  "not set yet" gap: `scripts/set-claims.mjs` ran against the live `dugo-plus`
  project with the service-account key, publishing `role`/`hospitalId` for every
  live account (four hospital staff, one admin, the rest donor). A signed-in
  session needs one `getIdToken(true)` (already forced at `useAuth`) or a
  sign-out/in to pick a claim up. Two `users` documents
  (`7XQmoK92…` mt-carmel, `k8l7kVup…`) have no Auth record and were skipped —
  the script now logs and continues instead of aborting on that. **Still open:**
  a hospital account created through the `/admin/accounts` browser fallback
  (D34, no `VITE_ACCOUNT_SERVICE_URL`) is born without the `staff` claim, so its
  facility reads are denied until `set:claims` runs for it; the worker/callable
  path publishes it at creation.
- **F9** built (D26/D27/D28): `/admin/profile` (FR-047), suspension/removal gate (`accountActive()` + `Blocked.jsx`), `/admin/accounts` with hospital creation (FR-040), `/admin/settings` (FR-041 settings half), `/admin/data-requests` and `/donor/privacy` (FR-039/NFR-19), `/privacy` (FR-019 notice), and the required registration consent whose acceptance is stored as `privacyConsentAt` + `privacyNoticeVersion` (D28). Open, in priority order: (1) **Blaze plan not confirmed or enabled**, so the two callables in `functions/index.js` are not deployed and the accounts screen's "New hospital account" path reports the undeployed service; `scripts/create-hospital.mjs` is the working fallback but has not been run here (no service-account key). (2) **Claims not run** on the live project (`scripts/set-claims.mjs`), so admin/staff rules paths are inert there. (3) **No signed-in live smoke**: the checkout is configured against `dugo-plus` through the gitignored `web/.env`, but there are no test-account credentials or published admin claim here, so none of the four §6 checks, the suspension behaviour, the DSR flow, the consent write or settings persistence has been exercised against the project — only the public pages (`/privacy` in both themes, the `/register` consent checkbox, `/login`, and the `/donor/privacy` → `/login` redirect) were rendered in a browser. (4) **`npm run test:rules` could not run here** — the Firestore emulator needs Java 21 and `java` is not installed; the extended suite (including the consent cases) is written but unexecuted locally (the CI `rules` job is the backstop). (5) **FR-041 "saved values are used" is undemonstrable**: the P5 matcher and notification worker that read `systemConfig/global` are F7's rows and do not exist in this checkout. (6) **First Google sign-in from `/login` records no consent** — the required checkbox is on `/register` only, so an account created through the `/login` provider button is auto-provisioned without `privacyConsentAt`/`privacyNoticeVersion`. The owner has not decided whether to gate that button, record acceptance inside the auto-provision path, or accept the gap; the question stays open until answered.
- **F9 blockers to unblock (owner action).** *Who deploys `firestore.rules`, and when?* — the F9 ruleset (admin update shape, `systemConfig` bounds, DSR enums/freeze, the D28 consent freeze) is **written but not deployed**; this checkout cannot deploy without authorization. *When is the Blaze plan enabled?* — required for `functions/index.js`; until then hospital creation runs through the free account service (D33) or the script. *When is hosting redeployed?* — the live site still serves a bundle built before D27/D28 (it has no `/privacy` route and no consent checkbox), so the registration consent will not appear on `https://dugo-plus.web.app` until hosting is rebuilt and deployed. None of these has an answer recorded, so all three are restated here.
- **The Blaze question has a free answer now (D33).** `workers/account-service/` runs the same privileged operations as `functions/index.js` on a free Node host (Vercel or Netlify), so hospital creation no longer needs Blaze or a script: set `VITE_ACCOUNT_SERVICE_URL` and the `/admin/accounts` form works. **D38 answers the host question:** the same operations now run on the existing Cloudflare Worker's `POST /accounts` against Google REST APIs (Identity Toolkit Admin + Firestore REST), because `firebase-admin` cannot run in the Workers runtime; Cloudflare's free tier has no non-commercial clause, so Vercel/Netlify is no longer the shipped path (the Node service stays as the reference implementation). Built and bundling clean; remaining owner action is to `npm run worker:deploy` and set `VITE_ACCOUNT_SERVICE_URL=https://dugo-matching.dugo-plus.workers.dev/accounts`. D34 adds a second free path for the common case: with no service configured, `/admin/accounts` writes the sign-in record (on a second app instance) and both documents straight from the browser — it needs the admin's `admin` claim and leaves the new account's `staff` claim unset.
- **Contradiction to resolve: did the `users` backfill run?** D22 (REQUIREMENTS) says `scripts/backfill-users-shape.mjs` migrated the live collection on 2026-10-22 (12 documents, verified, re-run a no-op) and the old-shape fallbacks were removed; the bullet above says it has not run and that the app still reads either shape. D22 is the later record and `readProfile` no longer has fallbacks, but the older bullet is not corrected until the owner confirms which is true.
- **F6 hospital inventory and subscription management built** (D27, D28): , , , , , and .
- **FR-024–027 block the donor, not the matcher.** The deferral gate is
  client-side: `/donor/requests` disables Accept (and re-checks in code) when the
  donor's `lastDonationAt` puts them inside the component interval. The F7
  matcher still sends the match — a deferred donor can open and decline it but
  not accept. The clock is now written: `confirmDonation` advances
  `users.lastDonationAt` (D35), so a staff confirmation starts the deferral.
  Open, owner action: FR-024–027 have not been smoked against a live account —
  confirm a donation as staff, then check the donor's Accept gate and profile
  countdown flip to deferred.
- **No staff read of `users`** — the rules grant an owner read plus an admin
  claim, and nothing else. Schema §6 allows a limited "staff of same hospital"
  read; hospital screens (F3/F6) will need to decide what it exposes before it
  is added. The shape itself is aligned (D22); this is about who may read it.
- **TTL policy on `emailVerifications.expiresAt`** (schema §4) is not
  deployable from `firebase.json`/the CLI — it needs a console or `gcloud`
  firestore field-ttl configuration. Not done.
- **Two schema §4 indexes are not in `firestore.indexes.json`, both
  deliberately**: `auditBlocks.sequence` is a single-field sort, and the
  collection-group `logs` index was rejected by the Firestore API ("this index
  is not necessary, configure using single field index controls") — both are
  served by the automatic single-field index. The file carries the other 12
  multi-field indexes from schema §4, all confirmed live 2026-10-21.
- **No CI deploy.** The `checks` workflow (`.github/workflows/checks.yml`) runs
  `check-docs`, the build, and the Firestore rules suite (`rules` job, D19) on
  every PR and push to `main`, and needs no secrets. Auto-deploying to Hosting
  is deliberately not part of it: shipping is
  manual from `prod` (D11). An automatic deploy would need a
  `FIREBASE_SERVICE_ACCOUNT` secret and the six `VITE_FIREBASE_*` values, and
  would make going live a side effect of a push. **Answered 2026-10-22:**
  branch protection on `integration` and `main` now requires both status
  checks, `checks` and `rules` (strict, re-run after merge).
- **Formspree activation pending.** The `/partner` intake posts to
  `VITE_FORMSPREE_ENDPOINT` (D21); Formspree's first submission triggers an
  activation email to the form owner, which must be clicked before live tests
  pass. Test the form twice after activating.
- **The data model now has one entry point.** `docs/firestore_schema.md` is cited
  as the model of record from `AGENTS.md`, `README.md`, `PROMPTING_GUIDE.md`,
  `CONTRIBUTING.md`, `docs/PHASES.md` §3/§11, and the service/page comments that
  touch Firestore. Its §0 carries the divergence table (D8/D10/D17, D12–D14,
  D18, D22) so the shipped build is not "corrected" back to the text, and its §9
  open questions are handled like the ones below — owner answers only.
- **The schema is the model of record, not a cap (D23).** Adding a collection or
  field the design needs is allowed; the obligation is visibility — write it into
  the schema and `docs/SCHEMA_CHANGELOG.md` in the same task, and add a `D*` row
  when it departs from what is written. §0.1's "do not invent collections" is
  gone, `[ADDED]` no longer means "Firestore mechanics only", and a new
  collection always gets a `D*` row (a new field only when it contradicts).
- **§9's ERD inconsistencies are answered where the build had already decided.**
  `bloodRequests.status` is `urgent | collecting | matched | fulfilled |
  cancelled` and `urgencyLevel` is `urgent | stat | routine` — both are the
  shipped `.chip[data-status]`/`.chip[data-priority]` codes, not chosen for the
  schema (D24); `component` is added as an FK to `donationTypes` (D24).
  `eligibilityInfo` was removed from the model of record — the ERD field was
  never implemented and eligibility is computed on read (D25); `changeType` is
  `DONATION | TRANSFUSION | ADJUSTMENT | EXPIRED` with a required `reason` on
  adjustments (D26); `Subscriptions.status` is `Active | Expired | Cancelled` and
  subscription `plan` is `Community Plan | Standard Partner | Regional Network`
  under self-serve hospital plan management (D28). Still open from
  §9: `responseStatus`, `consentType`, `channel`, `deliveryStatus`,
  `requestType`, DSR `status`, and the `notif_retry_interval` unit.
- **Write-up is now enforced, not just requested.** `node tools/check-docs.mjs`
  gained mechanical cross-checks: every `D*` in `docs/` resolves, the changelog's
  refs resolve, schema §1 collections and `firestore.rules` match paths agree in
  both directions, and field names the rules validate on `users` appear in §2.1.
  A change to `firestore.rules`/indexes/services with no `docs/` change warns
  (not fails — it cannot judge relevance). The cross-checks caught real drift on
  their first run: `errorLogs` was in the rules but missing from §1, and the
  rules' `eligibility` guard was not explained anywhere.
- **The one-shot Admin key is retired.** `npm run seed` and
  `npm run backfill:users` both need `GOOGLE_APPLICATION_CREDENTIALS`; the key
  lived outside the repo at `~/.config/dugo-plus/sa-key.json`. Both jobs ran
  (seed 2026-10-22; backfill 2026-10-22), after which the file was deleted and
  the key revoked in the console. A future re-seed generates a fresh key and
  revokes it after — no standing credential.
- **PR #13 merged without the §6 smoke list, on the owner's call.** The change
  touched `services/` and `firestore.rules`, so the list was required; the owner
  overrode it to merge, and then ran it — sign in, reload, save-then-reload, the
  unverified hold — all passing. Recorded because "merged unverified" and
  "verified late" are different states, and the reason is only in this note.
- **`users` now matches schema §2.1** (D22, resolving D16). The shape is
  `role | fullName | email | phoneNumber | bloodType | dateOfBirth |
  latitude | longitude | geohash | city | hospitalId | status | lastDonationAt`,
  with the lowercase role set; `address` is not collected and `isVerified` is not
  stored (Firebase Auth owns it, D5). `scripts/backfill-users-shape.mjs` migrates
  existing documents, and `readProfile`'s temporary old-name fallbacks are
  deleted once it has run on the live project.
- **`status`/`hospitalId` are written but not read.** The rules accept `status`
  (admin-only change, FR-040) and `hospitalId`, and both are stored, but no
  screen consumes them yet: a suspended account still works. The admin
  donor-registry screen (F9/F10) is what reads and sets them.
- **No browser render check.** Screens are verified by build and compiled output
  only. The one end-to-end pass was the email-verification flow on 2026-10-20.
- **No app test suite**: recorded as a gap, not scheduled. The exception is the
  Firestore rules — `firestore.rules.test.mjs` runs 172 asserts in the
  emulator, locally (`npm run test:rules`) and in CI (D19). The React app has
  no tests; the smoke list below is its check.
- **The deferral clock has a writer; reward points do not.** F6's
  `confirmDonation` runs as a client transaction (D27 — the owner chose to stay
  on Spark instead of the Blaze-plan functions build) and writes the donation
  record, the stock, its log and — since D35 — `users.lastDonationAt`, which the
  rules let a staff claim move forward only. `rewardTransactions` (D12, FR-036)
  stays server-only, so that row stays open until a server path exists outside
  the React app.
