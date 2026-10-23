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
| **P2** | Blood request submission and listing | not started |
| **P3** | Donor browse, respond, history, rewards, health tracker | partial (FR-010 derived on the profile only) |
| **P4** | Hospital dashboard, inventory, screening | not started |
| **P5** | Matching and notifications | not started; needs Cloud Functions (Blaze) |
| **P6** | Admin account management, data-request queue | partial (admin gate and FR-040/FR-047 beginnings) |
| **P7** | Hash-chain audit trail | not started; needs Cloud Functions |
| **P8** | Compliance and privacy | not started; mostly documents |
| **P9** | Non-functional hardening (responsiveness, scale, compatibility) | not started |

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
| F5 | Donor history, rewards and health tracker | P3 | FR-008, FR-009, FR-010 |
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

1. Sign in with email/password → lands on `/donor/profile`.
2. Reload `/donor/profile` → saved values appear (proves reads still work).
3. Change a field, save, reload → the change persisted (proves writes still work).
4. Sign out, sign in as an unverified account → still held at `/verify-email`
   (proves the gate survived).

**This is a stopgap, not a safety net.** A test suite (vitest plus React Testing
Library) would cover this class of breakage automatically on every PR. That work
is not scoped or scheduled; it is recorded here so the smoke list is not mistaken
for the real thing.

## 7. What needs work outside the app

Some rows cannot be finished from `web/src`. Do not mark them `done` from
frontend code alone.

| Needs | Rows (examples) | Requirement outside the app |
| --- | --- | --- |
| Cloud Functions | FR-007, FR-021, FR-036, FR-041, FR-042-045 | **the Blaze plan**: Functions cannot be deployed on Spark |
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

Stated every session until answered, explicitly withdrawn, or the work they block
is cancelled. An assumption is never recorded in place of an answer.

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
- **The `users` backfill has not run on the live project.** `npm run
  backfill:users` (dry by default; `--apply` writes) must run once before the
  fallbacks in `readProfile` are removed. Until then the app reads either shape
  correctly, so a missed document degrades to an empty field rather than an
  error.
- **Custom claims are not set anywhere yet** (D15): every admin/staff rule
  matches no session until `{ role, hospitalId }` claims are issued — a server
  step (Cloud Function or console), owned by F9/F12. Until then only
  owner-scoped paths are exercisable in production.
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
  never implemented and eligibility is computed on read (D25). Still open from
  §9: `Subscriptions.status`, `responseStatus`, `consentType`, `channel`,
  `deliveryStatus`, `changeType`, `requestType`, DSR `status`, subscription
  `plan`, and the `notif_retry_interval` unit.
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
  Firestore rules — `firestore.rules.test.mjs` runs 106 asserts in the
  emulator, locally (`npm run test:rules`) and in CI (D19). The React app has
  no tests; the smoke list below is its check.
