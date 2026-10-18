# AGENTS.md — Dugo+ Repo Rules

## Golden Rule
**Match the look, design the rest.** Stay inside the design system's visual
language (palette, typography, component styling); everything else — layout,
composition, new components, new screens, UX flows — is yours to design well.
The mockups in `light/` and `dark/` are a **style reference**, not a spec to
reproduce.

## Locked vs free

| Locked (the look) | Free (design it) |
| --- | --- |
| Colour palette + `data-*` state tones (in `styles/dugo.css`) | Page layout, grid, ordering, IA |
| Typography (Doto, Space Mono, DM Sans, Newsreader) + type scale | Which components you compose, or new ones |
| How `.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs` are styled | New components, screens, interactions, UX flows |
| Both themes (light + dark) must work | Spacing, density, new visual states within the palette |

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
- Prefer the existing tokens/classes. Keep light and dark themes working.

## Page Rules
- Admin pages → `<AppShell>`. Landing → no AppShell.
- Pages live under `web/src/pages/` in role folders: `admin/`, `donor/`,
  `hospital/` (the three account types), plus `public/` (landing + auth +
  not-found) and `shared/` (ScreenStub, Gallery).
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

## Verification
- `cd web && npx vite build`
- New UI works in **both** light and dark, and stays inside the locked palette/type.
- Mockups are a reference for the look — not a target to match pixel-for-pixel.
- After editing anything in `light/`, `dark/` or `styles/`, re-run `python3 tools/screenshots.py` so the README reference images don't go stale.
- Auth-touching changes: verify the two modes work: configured (with placeholder or real credentials) and the NotConfigured screen (missing values). No demo/fallback account exists any more.

## Cost/Context Rules
- Read files, don't paste large blobs (>~2–3KB). Avoid dumping entire generated files.
- One screen/component per task.
- Read 2–3 similar implementations before creating new code.
