# Dugo+

A blood bank and donor management web app: request blood, match donors, track
inventory, and record donations.

| Folder | What it is |
| --- | --- |
| `light/`, `dark/` | Clickable HTML mockups, one file per screen in both themes. The look-and-feel **style reference**. |
| `styles/` | The shared design system (CSS base): palette, type, and primitive styling. |
| `web/` | The React app, built on that design system. |
| `tools/` | Python scripts that produced `styles/` and seeded the first page bodies. Not needed to run the app. |

## How the repo fits together

```
light/*.html, dark/*.html     the style reference: 20 mockups, 10 screens
        │                     (plain HTML + CSS, no build step)
        │  extracted verbatim, once, by tools/
        ▼
styles/dugo.css               one design system, imported by both
        │
        ├──► light/*.html, dark/*.html   the mockups render from it
        └──▶ web/src/main.jsx            and so does the React app

tools/  build-time only, nothing here is needed to run or build the app
```

The mockups and the app share one stylesheet, so a base-CSS change applies to
both. `web/` reads `../styles`, `../fonts` and `../assets` by relative path,
which is why the app lives inside this repository rather than in its own. And the
mockups are a style reference, not a spec: they set the look, while the app's
layout and UX are designed as needed.

## Screenshots

Every screen exists twice, in light and dark, and the images below follow your
GitHub theme. The dashboard:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-dashboard.jpg">
  <img src="docs/screenshots/light/admin-dashboard.jpg" width="1200" alt="Dugo+ admin dashboard: KPI row, urgent request list, inventory tiles and donation trend charts">
</picture>

<details>
<summary><strong>All 10 screens, light and dark</strong></summary>

| Screen | In the app | Light | Dark |
| --- | --- | --- | --- |
| `landing.html` | ✓ | <img src="docs/screenshots/light/landing.jpg" width="360" alt="Landing page, light theme"> | <img src="docs/screenshots/dark/landing.jpg" width="360" alt="Landing page, dark theme"> |
| `admin-dashboard.html` | ✓ | <img src="docs/screenshots/light/admin-dashboard.jpg" width="360" alt="Dashboard, light theme"> | <img src="docs/screenshots/dark/admin-dashboard.jpg" width="360" alt="Dashboard, dark theme"> |
| `admin-blood-requests.html` | ✓ | <img src="docs/screenshots/light/admin-blood-requests.jpg" width="360" alt="Blood requests, light theme"> | <img src="docs/screenshots/dark/admin-blood-requests.jpg" width="360" alt="Blood requests, dark theme"> |
| `admin-donor-matching.html` | no | <img src="docs/screenshots/light/admin-donor-matching.jpg" width="360" alt="Donor matching, light theme"> | <img src="docs/screenshots/dark/admin-donor-matching.jpg" width="360" alt="Donor matching, dark theme"> |
| `admin-donor-registry.html` | no | <img src="docs/screenshots/light/admin-donor-registry.jpg" width="360" alt="Donor registry, light theme"> | <img src="docs/screenshots/dark/admin-donor-registry.jpg" width="360" alt="Donor registry, dark theme"> |
| `admin-inventory.html` | no | <img src="docs/screenshots/light/admin-inventory.jpg" width="360" alt="Inventory, light theme"> | <img src="docs/screenshots/dark/admin-inventory.jpg" width="360" alt="Inventory, dark theme"> |
| `admin-donations-rewards.html` | no | <img src="docs/screenshots/light/admin-donations-rewards.jpg" width="360" alt="Donations and rewards, light theme"> | <img src="docs/screenshots/dark/admin-donations-rewards.jpg" width="360" alt="Donations and rewards, dark theme"> |
| `admin-reports.html` | no | <img src="docs/screenshots/light/admin-reports.jpg" width="360" alt="Reports, light theme"> | <img src="docs/screenshots/dark/admin-reports.jpg" width="360" alt="Reports, dark theme"> |
| `admin-audit-trail.html` | no | <img src="docs/screenshots/light/admin-audit-trail.jpg" width="360" alt="Audit trail, light theme"> | <img src="docs/screenshots/dark/admin-audit-trail.jpg" width="360" alt="Audit trail, dark theme"> |
| `admin-settings.html` | no | <img src="docs/screenshots/light/admin-settings.jpg" width="360" alt="Settings, light theme"> | <img src="docs/screenshots/dark/admin-settings.jpg" width="360" alt="Settings, dark theme"> |

</details>

These are rendered straight from the **mockups** by
[`tools/screenshots.py`](#tooling-tools), so re-run it after changing a mockup.
They show the look the app is built on; the app's layout can differ (for example,
the landing page no longer carries the designed sign-in band, which now opens on
`/login`).

## Quick start

### 1. Browse the mockups (no setup needed)

Open the repository's `index.html` in a browser for a list of every screen, or go
straight to one, for example:

```
light/admin-dashboard.html
dark/admin-dashboard.html
```

They are plain HTML, so they work straight from the filesystem.

### 2. Run the app

```bash
cd web
npm install
npm run dev
```

Then open <http://localhost:5173>:

- `/`: landing page
- `/login`: sign in; `/register`: create a donor account
- `/partner`: partnership intake form (emails the partners mailbox)
- `/admin/dashboard`: admin area (sidebar shell; screens to be built)
- `/gallery`: every component, in both themes (useful while building screens)

The app needs a Firebase project: with no `web/.env.local` it stops on a setup
notice that names the missing values. Fill them in as described in
[Authentication](#authentication) before the routes open.

While the dev server is running, the mockups are served from the same origin, so
you can compare side by side:

```
http://localhost:5173/mockups/light/admin-blood-requests.html
```

### 3. Production build

```bash
cd web
npm run build     # writes web/dist/, must pass before committing
npm run preview   # serves the built app locally
```

**Requirements:** Node `^20.19.0 || >=22.12.0` and npm. Python 3 is only needed
for the scripts in `tools/`.

## What works today

The design system is complete and every screen exists as a look reference. These
routes are built in React so far:

| Route | Status |
| --- | --- |
| `/` | Landing page, built |
| `/login`, `/register` | Sign-in and donor-only registration: the public `.pub` band, owned by `AuthLayout`, backed by Firebase Auth |
| `/partner` | Partnership intake form, posts to Formspree (`VITE_FORMSPREE_ENDPOINT`) and emails the partners mailbox |
| `/welcome` | "You're in" notice — where donor and hospital accounts land (there are no screens for them yet); self-forwards admins to the dashboard |
| `/admin/dashboard`, `/admin/blood-requests` | Route + shell only — the sidebar-only admin chrome (`AppShell`), no page content yet; the mockups remain the look reference |
| `/admin/donor-matching`, `/admin/donor-registry`, `/admin/inventory`, `/admin/donations-rewards`, `/admin/reports`, `/admin/audit-trail`, `/admin/settings` | Placeholder (`ScreenStub`) linking the reference mockup; design and build these next |
| `/gallery` | Component gallery, every component rendered in both themes |
| anything else | Not found |

The app needs a Firebase project: if no `web/.env.local` exists, every route
shows `pages/shared/NotConfigured.jsx` with the variables to fill in. Once
configured, `/admin/*` requires a signed-in account with `role: "admin"`; see
[Authentication](#authentication). The remaining work is one screen at a time;
see [Building a screen](#building-a-screen).

## Authentication

Sign-in has one path through the app, and it is the same shape as
`web/src/hooks/useTheme.jsx`: a config module, one service, one context, one
hook:

```
web/.env.local ──► web/src/lib/firebase.js   env-driven initializeApp (null when unset)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
web/src/services/auth.js       web/src/services/users.js
the Auth SDK, the session      users/{uid} profiles: the account
listener, authErrorMessage()   type the guards read back
        │                               │
        └───────────────┬───────────────┘
                        ▼
                web/src/hooks/useAuth.jsx
              <AuthProvider> + useAuth() (the only way in)
                        │
        ┌───────────────┼───────────────────────────┐
        ▼               ▼                           ▼
  layout/RequireAuth  layout/RequireRole    pages/public/Login.jsx
  gates /admin/*      checks the type       Register.jsx, Partner.jsx
                      (/admin/* → admin)    layout/AppShell.jsx (sign-out)
```

### Configure a project

1. In the [Firebase console](https://console.firebase.google.com) create a
   project, add a **Web app**, and copy the config from *Project settings → Your
   apps*.
2. Copy `web/.env.example` to `web/.env.local` and fill in the six
   `VITE_FIREBASE_*` values.
3. Under *Authentication → Sign-in method*, enable **Email/Password** and
   **Google**.
4. Add `localhost` (and your deploy domain) under *Authentication → Settings →
   Authorized domains*.
5. Create a **Firestore database** (a good location, then start in test mode for
   the moment) so `users/{uid}` can be written.
6. Publish the security rules:
   ```bash
   npm install -g firebase-tools   # the CLI lives outside the repo
   firebase login
   firebase deploy --only firestore:rules
   ```

`web/.env.local` is gitignored, so no project is baked into the repository.

> The web API key is **not** a secret: it identifies the project and Firebase
> enforces access with its own rules. It ships in the client bundle either way,
> which is how every Firebase web app works.

### Without a project

The app does not run unconfigured. If any of the six values is missing or empty,
every route renders `web/src/pages/shared/NotConfigured.jsx` instead of the app,
naming the variables to fill in. A fresh clone is still reviewable: the mockups
under `light/` and `dark/` need no setup at all.

### What each piece does

| File | Role |
| --- | --- |
| `web/src/lib/firebase.js` | Reads the `VITE_FIREBASE_*` variables; exports `firebaseApp`, `auth`, `googleProvider`, `db`, `isFirebaseConfigured` and `missingFirebaseKeys`. |
| `web/src/services/auth.js` | The only module that talks to the Firebase Auth SDK: sign-in/up/out, the Google pop-up, the session listener, and `authErrorMessage()`. |
| `web/src/services/users.js` | The only module that talks to Firestore: reads and writes `users/{uid}`, plus `roleLabel()`. |
| `web/src/hooks/useAuth.jsx` | `AuthProvider` / `useAuth()`: `user`, `loading`, `role`, `profile`, `roleLoading`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`, built on the two services above. A session whose profile document is missing is auto-provisioned as a donor. |
| `web/src/layout/RequireAuth.jsx` | Is somebody signed in? Waits for the session, then redirects to `/login`, remembering the URL you wanted. |
| `web/src/layout/RequireRole.jsx` | Is the signed-in account of the right type? Mounted inside `RequireAuth` for `/admin/*`, with `roles={['admin']}`; a profile that failed to load reports the error with a sign-out button. |
| `web/src/layout/AuthLayout.jsx` | The public (`.pub`) chrome shared by the auth screens and `/partner`: header, footer, the copy column, and the colour tokens `.pub` carries. |
| `web/src/pages/public/Login.jsx`, `Register.jsx`, `Partner.jsx` | The screens, composed from the public classes (`.pub-card`, `.pub-form`, `.pub-btn`); the only new CSS is the `.pub-auth` full-height hook and the switch hooks in `dugo.extras.css`. |
| `web/src/layout/AppShell.jsx` | The admin chrome: left sidebar (logo, role label, nav, theme toggle, `$ exit` sign-out) and the content area. The mockup's top toolbar is deliberately not carried — sidebar-only per the owner's direction. |

Signing in happens on `/login`, and nowhere else. The landing page carries no
form: `tools/gen_pages.py` drops the designed `#signin` band from the seeded body
and turns the nav's call to action and the footer's *Admin Login* into router
links to `/login`. The mockups keep the designed band as the style reference; the
app just no longer renders it. Both screens render the landing's footer under the
band, so the page fills the viewport and the card stays centred.

Google sign-in lives on `/login` and `/register`.

The landing's three big CTAs: *Become a donor* and *Request blood* (D1 merged
receiving into the donor account) → `/register`, *Become a partner* → `/partner`
(the Formspree intake; facilities do not self sign-up).

### Account types

Firebase Auth has no role field, so each account type is a document:
`users/{uid}` with `{ role, name, email, createdAt }`, written through
`web/src/services/users.js` and read back on every session change.

- **Donor-only sign-up.** `/register` creates donor accounts only. A first
  Google sign-in (or any session whose profile document is missing) is
  auto-provisioned as a donor in `hooks/useAuth.jsx` — there is no role-picker
  screen, and `firestore.rules` freezing `role` means that write cannot demote
  an existing hospital or admin document. Hospital accounts are created by the
  Dugo+ team from a request on `/partner`; admins are granted as below.
- **Granting admin.** In the Firebase console, open *Firestore → `users` →
  `<uid>`* and set `role` to `admin`, then refresh the page. It never appears on
  the register screen, and `firestore.rules` freezes `role` after the document
  is created, so a profile cannot be upgraded from the client either.
- **Known limitation.** The role is written from the browser, so it is a UI
  boundary rather than a security boundary: a determined visitor could create
  their own `users/{uid}` with `role: "admin"`. Real enforcement needs a server,
  for example a custom claim set from a Cloud Function. Right now the rules
  limit each account to *its own* document and validate the shape of what it
  may contain, which is what the file is there to demonstrate.

## Where to start

Four documents, in the order you should read them:

| Doc | Contents |
| --- | --- |
| `AGENTS.md` | The repo rules. Read this first; it is short and important. |
| `docs/firestore_schema.md` | **The data model** — every collection and field (§2), the composite indexes (§4), where a transaction is required (§5), the security-rules outline (§6), and the seed data (§8). Any screen or service that reads or writes Firestore is built against this file; where the build deliberately differs, the `D*` row in `docs/REQUIREMENTS.md` says why. |
| `PROMPTING_GUIDE.md` | Structure, naming, and prompt templates for building a screen. |
| `web/src/components/CONVENTIONS.md` | The three component patterns to copy, and the rules around them. |
| `web/src/pages/shared/Gallery.jsx` | Working examples of every component. |

## Project layout

```
.
├── index.html              # Index of all mockups (open this in a browser)
├── light/                  # Light-theme mockups (10 screens)
├── dark/                   # Dark-theme mockups (10 screens)
├── styles/                 # Design system: dugo.css + the section files it imports
│   └── dugo.extras.css     # App-only additions (overlays, toasts, KPI row)
├── fonts/                  # Self-hosted webfonts
├── assets/                 # Shared assets (favicon)
├── docs/screenshots/       # Rendered mockups for this README (see tools/screenshots.py)
├── tools/                  # Python helpers, build-time only
└── web/                    # Vite + React app
    ├── .env.example        # Firebase config template (copy to .env.local)
    ├── index.html          # App entry point
    ├── vite.config.js      # Also serves the mockups at /mockups/*
    └── src/
        ├── main.jsx        # Entry: imports the base stylesheets + app.css, mounts <App>
        ├── App.jsx         # Routes (built slugs vs ScreenStub) + the auth gate
        ├── styles/app.css  # App-owned styling (new UI); base lives in repo styles/
        ├── hooks/          # React contexts/hooks
        │   ├── useTheme.jsx      # Light/dark theme context (`useTheme`)
        │   └── useAuth.jsx       # Session context (`useAuth`)
        ├── services/       # Data + external access (the only place Firebase SDK code is called)
        │   ├── auth.js           # Firebase Auth calls + readable error messages
        │   ├── users.js          # Firestore `users/{uid}` profiles
        │   └── requests.js       # Sample data (still the only source for the built admin list)
        ├── lib/firebase.js # Firebase app/auth/db from VITE_FIREBASE_* (null when unset)
        ├── utils/cx.js     # `cx()` classnames join used by the components
        ├── layout/         # AppShell, RequireAuth, RequireRole, AuthLayout (app chrome)
        ├── pages/          # Route pages, grouped by role
        │   ├── admin/             # dashboard, blood-requests (shell only, content to build)
        │   ├── donor/             # planned: profile, alerts, rewards
        │   ├── hospital/          # planned: requests, inventory
        │   ├── public/            # landing, login, register, partner, forgot-password, verify-email, not-found (+ seeded LandingBody)
        │   └── shared/            # ScreenStub, Gallery, Welcome
        └── components/     # Reusable UI primitives + CONVENTIONS.md
```

## The design system at a glance

One stylesheet (`styles/dugo.css`) defines the look the mockups and the app
share. Almost all state is expressed with **`data-*` attributes**, not new class
names:

```jsx
<Chip data-status="urgent">urgent</Chip>
<Card id="kpi-active-requests" data-trend="up">24</Card>
<button className="tab" data-active={active}>weekly</button>
```

`data-status=urgent` becomes red, `data-status=fulfilled` green, and so on: the
stylesheet maps attribute *values* to colours and states. Because the attributes
sit on the real elements, the same markup styles itself in both themes.

**What's locked:** the palette, the typography, and how the primitives
(`.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs`) are
styled. **What's free:** layout, composition, new components, and new screens.

New styles must work in **both** themes, and two rules keep things stable:

- **Don't edit the base stylesheets.** `styles/dugo.css` and
  `styles/dugo.extras.css` are shared with the mockups. App-only styling goes in
  `web/src/styles/app.css`, which only the React app loads.
- **Compose first.** Build pages from `web/src/components`; when the design needs
  something new, add a component (see `CONVENTIONS.md`) rather than ad-hoc markup.

Some ids carry meaning too: overlays derive their ids from a `name`
(`<name>-modal`, `<name>-drawer`, `<name>-backdrop`) and KPI cards derive
`<name>-label` / `<name>-value` / `<name>-trend` / `<name>-chart`.

## Building a screen

Every remaining admin screen is the same job. Take the smallest one first. The
screen sizes are roughly `settings` (4 KB) → `donor-registry` (7 KB) →
`blood-requests` (8 KB) → `audit-trail` → `reports` → `donations-rewards`
→ `donor-matching` → `inventory` (21 KB). The two screens already wired
(`dashboard`, `blood-requests`) render the shell only, so they are open too.

1. **Look at the reference:** `light/<screen>.html` and `dark/<screen>.html`
   show the intended look for that screen.
2. **Read the data model first:** open `docs/firestore_schema.md` §2 and read the
   collection this screen works on — its fields, required/optional, enums, and
   which parts are server-only (§5 transactions). If the screen writes, check §6
   for the rules path. Where the build deliberately differs from the file, the
   `D*` row in `docs/REQUIREMENTS.md` says why — follow the deviation, not the
   file.
3. **Read a worked example:** `web/src/pages/shared/Gallery.jsx` (every
   component in use) and `web/src/services/requests.js` (how request data is
   shaped for a list screen today; it is a stand-in, not the `bloodRequests`
   shape).
4. **Design and build the page** in `web/src/pages/admin/`, composing components
   (add a new one if the design needs it). Then add the slug to `TRANSLATED` in
   `web/src/App.jsx` so the route stops rendering the `ScreenStub`.
5. **Verify:** `cd web && npx vite build` must pass. Build with the design-system
   components/tokens and both themes come along for free; spot-check the other
   theme only if the screen adds custom visuals or one-off inline styles
   (`/gallery` renders every component in both themes).

Two things worth knowing:

- **Reuse the `data-*` hooks.** The base stylesheet targets them directly. For
  example `#requests-table td[data-status=urgent]` bolds a whole cell, so the
  attribute has to be on the `<td>`, not only on the chip inside it. Your own new
  styles go in `web/src/styles/app.css`.
- **The mockup is a look reference, not a spec.** Keep the palette/type and the
  feel; lay out and structure the screen however serves the user. Existing route
  slugs stay as they are, and the `NAV` in `web/src/layout/AppShell.jsx` is the
  single source for the sidebar order; new screens can be named freely.

## Adding styles

The base stylesheets are shared with the mockups and are treated as read-only:

- `styles/dugo.css`: the design system (palette, type, primitives).
- `styles/dugo.extras.css`: shared app-only hooks (overlays/toasts).

Anything new the app needs goes in **`web/src/styles/app.css`**, imported by
`web/src/main.jsx`. Keep selectors app-scoped, reuse the CSS custom properties the
base defines, and check the result in both themes.

## Tooling (`tools/`)

Python 3 scripts used to build this repo, and **you do not need them to run or
build the app**. Two of them produced the design system, one seeded the first page
bodies, and the screenshot tool keeps this README in step with the mockups. Only
the last one needs dependencies beyond the standard library.

| Script | Purpose |
| --- | --- |
| `extract_design_system.py` | One-time **phase 1**: split the mockups' inline `<style>` into `styles/`, decode the fonts into `fonts/`, write `assets/favicon.png`. Verified lossless. |
| `refactor_mockups.py` | One-time **phase 2**: point the 20 mockups at `styles/dugo.css` instead of the inline block. Verified reversible. |
| `csslib.py` | Shared CSS parsing helpers for the two scripts above. |
| `htmltojsx.py` | Exact HTML → JSX converter (used by `gen_pages.py`). |
| `gen_pages.py` | The one-time scaffold that produced the first seeded page bodies (the admin dashboard's and the landing's) from the mockups. `LandingBody.jsx` is still normal, editable source; `DashboardBody.jsx` was removed with the shell strip, so the dashboard body is to be rebuilt against `docs/firestore_schema.md`. You don't need to run this. |
| `screenshots.py` | Render every mockup to `docs/screenshots/` for this README. Needs a one-time `pip3 install --user playwright pillow` and `python3 -m playwright install chromium`. **Re-run it after changing any mockup**, or the README keeps showing the old reference. |

## Tech stack

- **App:** JavaScript (`.jsx`) with React 19, React Router 7, built by Vite 8.
- **Auth:** Firebase Authentication (`firebase` v13), configured from
  `web/.env.local`, optional, so the app also runs without it.
- **Mockups:** plain HTML + CSS + a little vanilla JavaScript, no build step.
- **Design system:** one hand-written stylesheet, split into section files that
  `dugo.css` imports in cascade order.
- **Tooling:** Python 3.

## Planned: the API

There is **no backend yet**: every screen renders from `web/src/services/`. When
the API exists it will live in its own repository, and this app will:

- replace the fixtures in `web/src/services/*` with a `web/src/api/` client,
- read the base URL from `VITE_API_URL` (baked in at build time, so one build per
  environment), and
- proxy `/api` to the backend in `vite.config.js` during development, which keeps
  CORS out of the way locally.

Because the screens are already data-driven, that swap should not require
rewriting the pages.

Two things are stubbed until the API arrives:

- **Roles live in Firestore.** Each account's type is stored in
  `users/{uid}`. Register is donor-only (D20); admins are
  granted by editing that document in the Firebase console. See
  [Account types](#account-types).
- **Nothing is fetched.** The screens read the fixtures in `web/src/services/*`
  as a stand-in for the response shape, and the two built admin screens were
  reduced to the shell by the owner's direction — `services/requests.js` keeps
  the request shape for when they are rebuilt.

## License

No `LICENSE` file is included in this repository yet, so no license is granted by
default.
