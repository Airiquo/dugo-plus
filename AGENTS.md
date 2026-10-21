# AGENTS.md — Dugo+ Repo Rules

## Golden Rule
**The design system is a reference, not a spec.** Tokens and primitives are
shared defaults — extend or override them deliberately, keeping one concept to
one value so both themes keep working. **Layout and composition are yours
entirely.** The mockups in `light/` and `dark/` are examples of the style, not
design targets; matching them is not a goal.

Visual quality is a requirement, not a byproduct of consistency. A screen built
from the right tokens that still looks unappealing has failed.

## Shared defaults vs yours

| Shared defaults (extend or override deliberately) | Yours to design |
| --- | --- |
| Colour palette + `data-*` state tones (in `styles/dugo.css`) | Page layout, grid, ordering, IA |
| Typography (Doto, Space Mono, DM Sans, Newsreader) + type scale | Which components you compose, or new ones |
| How `.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs` are styled | New components, screens, interactions, UX flows |
| Both themes (light + dark) keep working — they switch off tokens, so no per-page theme work | Spacing, density, new visual states within the palette |

## Handoff
**Read these before starting work, in this order:**
1. `docs/REQUIREMENTS.md` — the FR/NFR table. Status, Notes and the Feature
   column are the source of truth for what is left and which feature owns it.
2. `docs/PHASES.md` — how work is split (one feature, one person, taken to
   working), the feature roster (`F1`–`F12`), the branch model, the manual
   smoke list, and §10's open questions.
3. `docs/firestore_schema.md` — the data model: collections and fields (§2),
   composite indexes (§4), the rules outline (§6), seed data (§8). Anything
   touching `firestore.rules`, `firestore.indexes.json` or Firestore writes
   checks against this file first.
4. `CONTRIBUTING.md` — branches, the PR checklist, and shipping.

Do not restate process here. If a branch, shipping or ownership rule is needed,
it belongs in one of those three files.

## Write-back
A task is not complete until these are updated **in the same commit**:
- `docs/REQUIREMENTS.md` — the row(s) it moved: Status, Notes, Where/evidence.
- `docs/PHASES.md` §2 — the phase's status line, if a count changed.
- `docs/PHASES.md` §10 — any open question it raised, and any it answered.

`node tools/check-docs.mjs` enforces the table half of this. Run it before
committing; an unfilled row fails the check rather than passing silently.

## Owner instructions
- An explicit instruction from the project owner wins over any default in this
  file. State the trade-off once, then implement it — no re-arguing, no asking
  the same thing twice.
- A deliberate deviation from a shared default is recorded in `app.css` with a
  short comment saying it is intentional.

## Unanswered questions
- If a question goes unanswered, **do not pick a default and proceed**. Restate
  the question, and what is blocked on it, on every turn until it is answered or
  explicitly withdrawn by the owner.
- Never record an assumption in place of an answer. "I'll assume X" is not an
  acceptable resolution.
- A question stops being asked only by being answered, by explicit withdrawal,
  or because the work it blocked is cancelled or descoped — and that drop is
  stated, never silent.

## Component Rules
- Components live in `web/src/components/` (PascalCase). Export from `components/index.js`.
- **New components are welcome.** Reuse existing primitives first; when the design needs something new, build it following `CONVENTIONS.md`.
- Accept arbitrary `data-*` and standard HTML props; forward `{...rest}` to root (last). Document non-obvious props in JSDoc.
- Use `cx()` from `utils/cx.js`.
- Modals/drawers: use `name` to derive `-modal/-drawer/-backdrop`. KPI: use `name` to derive `-label/-value/-trend/-chart`.
- Reuse the stylesheet hooks: `.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs`, etc.

## Styling Rules
- `styles/dugo.css` and `styles/dugo.extras.css` are the shared base — **don't edit** them.
- New app styling goes in `web/src/styles/app.css` (imported by `main.jsx`).
- Build from the shared tokens/classes where they fit, and override them where the
  design needs better. Keep one concept to one value: raw colours or
  theme-specific values for something the tokens already define are what break
  the other theme.

## Page Rules
- Admin pages → `<AppShell>`. Landing → no AppShell.
- Pages live under `web/src/pages/` in role folders: `admin/`, `donor/`,
  `hospital/` (the three account types), plus `public/` (landing + auth +
  not-found) and `shared/` (ScreenStub, Gallery, Welcome).
- `admin/DashboardBody.jsx` and `public/LandingBody.jsx` were seeded from the
  mockups — edit them freely now.
- A screen with nothing built yet → `shared/ScreenStub` (links the reference
  mockup). Building it = replace the stub and wire the route in `App.jsx`.
- Existing route slugs stay as they are; name new routes however makes sense.
- Auth screens (`/login`, `/register`, `/account/role`) own the sign-in band — the landing page
  carries no form — via `layout/AuthLayout.jsx`; `/admin/*` sits behind
  `layout/RequireAuth.jsx` and `layout/RequireRole.jsx` (admin only).

## Auth Rules
- One way in: `lib/firebase.js` → `services/auth.js` → `hooks/useAuth.jsx` (`useAuth()`) → `RequireAuth`. Pages never call the Firebase SDK directly.
- `VITE_FIREBASE_*` lives in `web/.env.local` (gitignored); `web/.env.example` is the committed template. Never bake a project into source.
- **App requires Firebase:** without a configured project, every route renders `pages/shared/NotConfigured.jsx`. Don't add an unconfigured pass-through.
- **Account types:** `users/{uid}` in Firestore stores `{ role, name, email, createdAt }` (donor | hospital | admin). `/admin/*` needs `role === 'admin'`. Register offers donor and hospital only; admins are granted by editing that document. The role is client-written (a UI boundary, not a security boundary).

## Folder/Organization Rules
- Follow §4 of PROMPTING_GUIDE.md. Keep structure flat and predictable.
- `web/src/` is layered by responsibility:

  ```text
  web/src/
  ├── components/   # reusable UI primitives (+ index.js barrel, CONVENTIONS.md)
  ├── styles/       # app.css — app-owned styling (base lives in repo styles/)
  ├── layout/       # AppShell, RequireAuth, RequireRole, AuthLayout (app chrome)
  ├── pages/        # route screens, grouped by role (admin/donor/hospital/public/shared)
  ├── hooks/        # React context/hooks (useAuth, useTheme)
  ├── services/     # data + external access (auth, users, requests) — the only place the SDK is called
  ├── lib/          # third-party setup (firebase config)
  ├── utils/        # framework-free helpers (cx)
  ├── App.jsx, main.jsx
  ```

- PascalCase for components/pages. camelCase for hooks/services/utils. kebab-case for slugs/filenames where existing.
- One concern per file. Barrel exports minimal/stable.
- Auth chain, always in this order: `lib/firebase.js` → `services/auth.js` (and `services/users.js`) → `hooks/useAuth.jsx` → pages/layout. Pages never import the Firebase SDK.

## Workflow
- Work lives on `feat/*` branches off `integration`; feature PRs target
  `integration`, and `integration` is merged into `main`. Details in
  `CONTRIBUTING.md`.
- Three files are touched by nearly every feature and take **one writer at a
  time**: `web/src/App.jsx`, `firestore.rules`, `docs/REQUIREMENTS.md`.
- `main` and `integration` are protected (PR, passing `checks`, up to date);
  `prod` is a release mirror, fast-forwarded from `main` only, and nobody
  commits to it. Deploys go through `tools/deploy.sh` from `prod`; see
  `docs/DEPLOY.md`.

## Comment Rules
- Comments describe **what** the code does, not **why** a decision was made. State facts about the code; leave the history and justification out.
- Keep them short. JSDoc on components documents props and behaviour; prose block comments describe the file or block in one or two lines.
- Docblocks at the top of a seeded/edited page say what the file holds and what it attaches — no "never hand-edit" or design-story narration.

## Requirements Rules
- `docs/REQUIREMENTS.md` is the FR/NFR traceability table (one row per requirement from the System Analysis spec).
- Screens and features map to requirement IDs. A task that implements or changes behaviour covered by a requirement updates that row (Status + Notes + Where/evidence) in the same task.
- **Notes** records deviations and changes (a `D*` reference, a descope, stricter or looser than spec) and is required whenever Status moves to `done` or `partial`. Where/evidence does not restate a decision: state it once, in Notes.
- **Feature** names the feature that completes the row (`F1`–`F12`, roster in `docs/PHASES.md` §4). A row finished across several features names each one.
- The table's Status column is the source of truth for what's left; build against the next phase's rows, one screen/component per task.
- Rows whose Class is not `app-code` (cloud-function, firestore-rules, external-service, ops-config, compliance-doc) need work outside the React app — don't mark them done from frontend code alone.
- `node tools/check-docs.mjs` validates the table (Feature present, `F*`/`D*` refs resolve, Notes present on `done`/`partial`). It must pass.

## Verification
- `cd web && npx vite build`
- `node tools/check-docs.mjs` — validates the traceability table.
- **Smoke list.** There is no test suite. For anything touching `services/`,
  `lib/` or `firestore.rules`, run the four manual checks in `docs/PHASES.md`
  §6: sign in lands on `/donor/profile`; reload shows saved values; a save
  persists across reload; an unverified account is still held at `/verify-email`.
  The build catches signature changes, not behaviour changes.
- **Done means designed.** Before calling a screen finished, check it against:
  - **Hierarchy** — the eye lands somewhere, and it is the right place.
  - **Spacing rhythm** — deliberate and consistent, not default browser gaps.
  - **States** — empty, loading, error, disabled and focus, not just the happy path.
  - **Would this look at home on a good production site?** Consistency with the
    mockups is *not* the bar.
- Both themes keep working off the tokens, so no per-page theme work is needed.
  Spot-check the other theme when a screen adds custom visuals (gradients, glows,
  overlays) or one-off inline styles; `/gallery` renders every component in both
  themes for the component-level check.
- After editing anything in `light/`, `dark/` or `styles/`, re-run `python3 tools/screenshots.py` so the README reference images don't go stale.
- Auth-touching changes: verify the two modes work: configured (with placeholder or real credentials) and the NotConfigured screen (missing values). No demo/fallback account exists any more.
- When a change is claimed to affect compiled output (CSS values, icons, routes),
  confirm it in `dist/` rather than only in the source file.

## Cost/Context Rules
- Read files, don't paste large blobs (>~2–3KB). Avoid dumping entire generated files.
- One screen/component per task.
- Read 2–3 similar implementations before creating new code.
