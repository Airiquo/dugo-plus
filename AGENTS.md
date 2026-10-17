# AGENTS.md — Dugo+ Repo Rules

## Golden Rule
**Mimic, don't invent.** Before creating/editing, read the nearest existing implementation and follow its exact pattern.

## Component Rules
- Components live in `web/src/components/` (PascalCase). Export from `components/index.js`.
- Accept arbitrary `data-*` and standard HTML props; forward `{...rest}` to root (last). Document non-obvious props in JSDoc.
- Use `cx()` from `./types`. Never add new base CSS classes.
- Modals/drawers: use `name` to derive `-modal/-drawer/-backdrop`. KPI: use `name` to derive `-label/-value/-trend/-chart`.
- Respect stylesheet hooks: `.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs`, etc. Don't rename.
- No changes to `styles/*.css` verbatim. Only `styles/dugo.extras.css` for generic, reusable hooks (justify first).

## Page Rules
- Admin pages → `<AppShell>`. Landing → no AppShell.
- Faithful bodies (`DashboardBody.jsx`, `LandingBody.jsx`) are generated — do not reformat.
- Untranslated screens → `ScreenStub`. Translating replaces stub + wires route in `App.jsx`.
- Route slugs must match mockup filenames (`admin-*.html`).
- Auth screens (`/login`, `/register`) own the sign-in band — the landing page
  carries no form — via `layout/AuthLayout.jsx`; `/admin/*` sits behind
  `layout/RequireAuth.jsx`.

## Auth Rules
- One way in: `firebase.js` → `auth.jsx` (`useAuth()`) → `RequireAuth`. Pages never call the Firebase SDK directly.
- `VITE_FIREBASE_*` lives in `web/.env.local` (gitignored); `web/.env.example` is the committed template. Never bake a project into source.
- Keep the app usable *unconfigured*: with no project, `/admin/*` is ungated and the shell keeps its demo identity (`Maria Santos`).

## Folder/Organization Rules
- Follow §4 of PROMPTING_GUIDE.md. Keep structure flat and predictable.
- PascalCase for components/pages. camelCase for hooks/utils. kebab-case for slugs/filenames where existing.
- One concern per file. Barrel exports minimal/stable.

## Verification
- `cd web && npx vite build`
- Compare against `/mockups/light/<target>.html` for visual parity.
- After editing anything in `light/`, `dark/` or `styles/`, re-run `python3 tools/screenshots.py` so the README images don't go stale.
- Auth-touching changes: check **both** modes — unconfigured (no `web/.env.local`) and configured with placeholder values — because the guard and the screens change behaviour with the env.

## Cost/Context Rules
- Read files, don't paste large blobs (>~2–3KB). Avoid dumping entire generated files.
- One screen/component per task.
- Read 2–3 similar implementations before creating new code.
