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
| **P3** | Donor browse, respond, history and health tracker | partial (F4 donor requests/respond/map built; D42 requests/alerts redesign and single-commitment service built; D49 requires a complete donor profile before acceptance; F5 history/tracker at `/donor/activity`; rewards removed by D43; coordinated rollout pending) |
| **P4** | Hospital dashboard, inventory, screening | partial (D63: facility details/read-only map, complete period summaries, component/group inventory, Worker screening/confirmation/stock movements; local verification complete, production rollout pending; plan management removed) |
| **P5** | Matching and notifications | in progress (F7 Part 1+2); needs Cloudflare Worker (free) + optional Brevo |
| **P6** | Admin account management, data-request queue | partial (F9: FR-047 profile page; suspension/removal gate + `/admin/accounts` with hospital creation + `/admin/settings` + `/admin/data-requests` + `/donor/privacy` + `/privacy` + required registration consent recorded on the profile, built and building clean; D40: versioned Worker account operations, durable audit outbox and owned provisioning recovery built; 181 rules checks, 64 unit/regression tests and four REST-emulator tests pass locally; coordinated deployment/live-provider smoke pending; functions not deployed, no signed-in smoke here) |
| **P7** | Hash-chain audit trail | in progress (F10a/F10b; D40 account/erasure outbox and erasable context verified locally; other DSR hooks remain best-effort; D63 donation/inventory outbox is locally verified, production rollout pending) |
| **P8** | Compliance and privacy | partial (D71 hospital contact reads enforce match-specific donor consent; compliance documents and production verification remain) |
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
firebase use dugo-plus-clean
```

The app does not run unconfigured: with any `VITE_FIREBASE_*` missing, every
route renders `pages/shared/NotConfigured`.

## 10. Open questions


- **Hospital Donors directory (2026-11-04, D82):** owner requests completed donors at the signed-in facility, explicit View donor history and complete CSV/Print-PDF controls. Implemented against the published sibling completion read contract, including legacy confirmations, without copying its writes or changing stock. Donor identities remain behind current match-specific consent. Page-local filters/counts and explicit all-page export scopes are documented in `docs/HOSPITAL_DONORS_DIRECTORY.md`. No product question or phase-count change. Additive index/Worker/Hosting rollout and browser/authenticated review remain; local browser use is disabled in Work settings.

- **Workspace controls/navigation (2026-11-04, D74):** owner requests compact donor Requests/Activity, Alerts with only a sort dropdown, and removal of universal filter cards across Admin/Hospital. Activity retains CSV/PDF; Requests/Alerts exports are removed. The owner explicitly chooses all matching rows in current sort order across pagination for remaining exports. Hospital sidebar creation is removed; History is shortened; facility names stay stable between routes; all account identities, sticky staff sidebars and footer scroll limits are addressed. No unresolved product question or phase-count change. Verification and release scope are in `docs/WORKSPACE_CONTROLS.md`.
