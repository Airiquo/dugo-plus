# Dugo+

A blood bank and donor management web app: request blood, match donors, track
inventory, and record donations.

The design lives in this repository together with the app, and both run off the
same stylesheet — so the app keeps the look the mockups established.

| Folder | What it is |
| --- | --- |
| `light/`, `dark/` | Clickable HTML mockups — one file per screen, in both themes. The look-and-feel **style reference**. |
| `styles/` | The shared design system (CSS base) — palette, type, and primitive styling. |
| `web/` | The React app, built on that design system. |
| `tools/` | Python scripts that produced `styles/` and seeded the first page bodies. Not needed to run the app. |

The app is plain **JavaScript** (`.jsx` / `.js`) on **Vite + React** — there is no
TypeScript in this repository.

## How the repo fits together

```
light/*.html, dark/*.html     the style reference — 20 mockups, 10 screens
        │                     (plain HTML + CSS, no build step)
        │  extracted verbatim, once, by tools/
        ▼
styles/dugo.css               one design system, imported by both
        │
        ├──► light/*.html, dark/*.html   the mockups render from it
        └──▶ web/src/main.jsx            and so does the React app

tools/  build-time only — nothing here is needed to run or build the app
```

Three things follow from that shape, and they explain most of the layout:

- **The mockups and the app share one stylesheet**, so a screen looks on-brand in
  both and a base-CSS change applies to both.
- **`web/` reads `../styles`, `../fonts` and `../assets` by relative path.** That
  is why the app lives *inside* this repository rather than in its own.
- **The mockups are a reference, not a spec.** They define the look — palette,
  type, component styling. The app matches that look; layout, composition, and UX
  are designed as needed and may improve on the mockups.

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
| `admin-donor-matching.html` | — | <img src="docs/screenshots/light/admin-donor-matching.jpg" width="360" alt="Donor matching, light theme"> | <img src="docs/screenshots/dark/admin-donor-matching.jpg" width="360" alt="Donor matching, dark theme"> |
| `admin-donor-registry.html` | — | <img src="docs/screenshots/light/admin-donor-registry.jpg" width="360" alt="Donor registry, light theme"> | <img src="docs/screenshots/dark/admin-donor-registry.jpg" width="360" alt="Donor registry, dark theme"> |
| `admin-inventory.html` | — | <img src="docs/screenshots/light/admin-inventory.jpg" width="360" alt="Inventory, light theme"> | <img src="docs/screenshots/dark/admin-inventory.jpg" width="360" alt="Inventory, dark theme"> |
| `admin-donations-rewards.html` | — | <img src="docs/screenshots/light/admin-donations-rewards.jpg" width="360" alt="Donations and rewards, light theme"> | <img src="docs/screenshots/dark/admin-donations-rewards.jpg" width="360" alt="Donations and rewards, dark theme"> |
| `admin-reports.html` | — | <img src="docs/screenshots/light/admin-reports.jpg" width="360" alt="Reports, light theme"> | <img src="docs/screenshots/dark/admin-reports.jpg" width="360" alt="Reports, dark theme"> |
| `admin-audit-trail.html` | — | <img src="docs/screenshots/light/admin-audit-trail.jpg" width="360" alt="Audit trail, light theme"> | <img src="docs/screenshots/dark/admin-audit-trail.jpg" width="360" alt="Audit trail, dark theme"> |
| `admin-settings.html` | — | <img src="docs/screenshots/light/admin-settings.jpg" width="360" alt="Settings, light theme"> | <img src="docs/screenshots/dark/admin-settings.jpg" width="360" alt="Settings, dark theme"> |

</details>

These are rendered straight from the **mockups** by
[`tools/screenshots.py`](#tooling-tools) — so if you change a mockup, re-run it,
or the README will show the old reference. They document the look the app is
built on; the app may differ from them in layout (e.g. the landing page no longer
carries the designed sign-in band — that band now opens on `/login`).

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

- `/` — landing page
- `/login` — sign in; `/register` — create an account
- `/admin/dashboard` — admin dashboard
- `/admin/blood-requests` — blood requests list
- `/gallery` — every component, in both themes (handy while building screens)

Auth is optional locally: with no `web/.env.local` the app runs *unconfigured*
and every admin screen still opens. To wire up real sign-in, see
[Authentication](#authentication).

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
| `/` | Landing page — built |
| `/login`, `/register` | Sign-in and registration — the public `.pub` band, owned by `AuthLayout`, backed by Firebase Auth |
| `/admin/dashboard` | Dashboard — built |
| `/admin/blood-requests` | Blood requests list — built, renders from `web/src/services/requests.js` |
| `/admin/donor-matching`, `/admin/donor-registry`, `/admin/inventory`, `/admin/donations-rewards`, `/admin/reports`, `/admin/audit-trail`, `/admin/settings` | Placeholder (`ScreenStub`) linking the reference mockup — design and build these next |
| `/gallery` | Component gallery — every component rendered in both themes |
| anything else | Not found |

`/admin/*` is only gated when a Firebase project is configured — see
[Authentication](#authentication). The remaining work is one screen at a time —
see [Building a screen](#building-a-screen).

`/admin/*` is only gated when a Firebase project is configured — see
[Authentication](#authentication). The remaining work is one screen at a time —
see [Building a screen](#building-a-screen).

## Authentication

Sign-in has one path through the app, and it is deliberately the same shape as
`web/src/hooks/useTheme.jsx` — a config module, one service, one context, one
hook:

```
web/.env.local ──► web/src/lib/firebase.js   env-driven initializeApp (null when unset)
                        │
                        ▼
                web/src/services/auth.js      the only module calling the SDK
                        │
                        ▼
                web/src/hooks/useAuth.jsx     <AuthProvider> + useAuth() — the only way in
                        │
        ┌───────────────┼───────────────────────────┐
        ▼               ▼                           ▼
  layout/RequireAuth   pages/public/Login.jsx   layout/AppShell.jsx
  gates /admin/*       pages/public/Register.jsx sign-out (sidebar + topbar drawer)
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

`web/.env.local` is gitignored, so no project is baked into the repository.

> The web API key is **not** a secret: it identifies the project and Firebase
> enforces access with its own rules. It ships in the client bundle either way —
> that is how every Firebase web app works.

### With and without a project

Someone who has just cloned this repository must still be able to review every
screen, so **auth is only enforced when a project is configured**:

| `web/.env.local` | `/admin/*` | Sign-in screens |
| --- | --- | --- |
| absent or empty | renders freely — the guard passes through and the shell keeps its demo identity | explain that Firebase is not configured |
| filled in | `RequireAuth` waits for the session, then redirects to `/login`, remembering the URL you wanted | sign in, register, Google, and readable error messages all work |

### What each piece does

| File | Role |
| --- | --- |
| `web/src/lib/firebase.js` | Reads the `VITE_FIREBASE_*` variables; exports `auth`, `googleProvider` and `isFirebaseConfigured`. |
| `web/src/services/auth.js` | The only module that talks to the Firebase Auth SDK: sign-in/up/out, the Google pop-up, the session listener, and `authErrorMessage()`. |
| `web/src/hooks/useAuth.jsx` | `AuthProvider` / `useAuth()` — `user`, `loading`, `configured`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`, built on the service above. |
| `web/src/layout/RequireAuth.jsx` | The `/admin/*` gate. |
| `web/src/layout/AuthLayout.jsx` | The public (`.pub`) chrome shared by both auth screens: header, footer, the register-only account-type picker, and the colour tokens `.pub` carries. |
| `web/src/pages/public/Login.jsx`, `Register.jsx` | The two screens, composed from the public classes (`.pub-card`, `.pub-form`, `.pub-btn`) — the only new CSS is the `.pub-auth` full-height hook and the switch hooks in `dugo.extras.css`. |
| `web/src/layout/AppShell.jsx` | Shows the signed-in name and signs out from the sidebar (`$ exit`) or the topbar chip's drawer. |

Signing in happens on `/login`, and nowhere else. The landing page carries no
form: `tools/gen_pages.py` drops the designed `#signin` band from the generated
body and turns the nav's call to action and the footer's *Admin Login* into router
links to `/login` (the mockups keep the designed band — they are the design
source, the app just no longer renders it). Both screens render the landing's
footer under the band, so the page fills the viewport and the card stays centred.

Google sign-in lives on `/login` and `/register`.

The landing's three big CTAs are its "get started" affordances and open the
register screen: *Become a donor* → `/register?role=donor`, *Request blood* →
plain `/register`, *Become a partner* → `/register?role=hospital`.

> **The role selector is presentational**, and only `/register` asks: the three
> account types are donor, hospital / blood bank, and system admin. Firebase Auth
> has no field for a role, so the choice only drives the highlight and nothing is
> stored yet — see [Planned: the API](#planned-the-api).

## Where to start

Four documents, in the order you should read them:

| Doc | Contents |
| --- | --- |
| `AGENTS.md` | The repo rules. Read this first — it is short and load-bearing. |
| `PROMPTING_GUIDE.md` | Structure, naming, and prompt templates for building a screen. |
| `web/src/components/CONVENTIONS.md` | The three component patterns to copy, and the rules around them. |
| `web/src/pages/shared/Gallery.jsx` | Working examples of every component — the fastest way to see how to use one. |

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
├── tools/                  # Python helpers — build-time only
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
        ├── services/       # Data + external access (never imported by components)
        │   ├── auth.js           # Firebase Auth calls + readable error messages
        │   └── requests.js       # Sample data (the shape the API is expected to return)
        ├── lib/firebase.js # Firebase app/auth from VITE_FIREBASE_* (null when unset)
        ├── utils/cx.js     # `cx()` classnames join used by the components
        ├── layout/         # Admin shell (sidebar / topbar / main), RequireAuth, AuthLayout
        ├── pages/          # Route pages, grouped by role
        │   ├── admin/             # dashboard, blood-requests (+ seeded DashboardBody)
        │   ├── donor/             # planned: profile, alerts, rewards
        │   ├── hospital/          # planned: requests, inventory
        │   ├── public/            # landing, login, register, not-found (+ seeded LandingBody)
        │   └── shared/            # ScreenStub, Gallery
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

`data-status=urgent` becomes red, `data-status=fulfilled` green, and so on — the
stylesheet maps attribute *values* to colours and states. Because the attributes
sit on the real elements, the same markup styles itself in both themes.

**What's locked:** the palette, the typography, and how the primitives
(`.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs`) are
styled. **What's free:** layout, composition, new components, and new screens.

Two rules keep this coherent:

- **Don't edit the base stylesheets.** `styles/dugo.css` and
  `styles/dugo.extras.css` are the shared base. New app styling goes in
  `web/src/styles/app.css`, which only the React app loads.
- **Compose first.** Build pages from `web/src/components`; when the design needs
  something new, add a component (see `CONVENTIONS.md`) rather than ad-hoc markup.

New styles must work in **both** themes.

Some ids carry meaning too: overlays derive their ids from a `name`
(`<name>-modal`, `<name>-drawer`, `<name>-backdrop`) and KPI cards derive
`<name>-label` / `<name>-value` / `<name>-trend` / `<name>-chart`.

## Building a screen

Every remaining admin screen is the same job. Take the smallest one first — the
screen sizes are roughly `settings` (4 KB) → `donor-registry` (7 KB) →
`blood-requests` (8 KB, done) → `audit-trail` → `reports` → `donations-rewards`
→ `donor-matching` → `inventory` (21 KB).

1. **Look at the reference** — `light/<screen>.html` and `dark/<screen>.html`
   show the intended look for that screen.
2. **Read a worked example first** — `web/src/pages/admin/BloodRequests.jsx` (a list
   screen end to end), `web/src/pages/shared/Gallery.jsx` (every component in use), and
   `web/src/services/requests.js` (how the data is shaped).
3. **Design and build the page** in `web/src/pages/admin/`, composing components
   (add a new one if the design needs it). Then add the slug to `TRANSLATED` in
   `web/src/App.jsx` so the route stops rendering the `ScreenStub`.
4. **Verify** — `cd web && npx vite build` must pass, and check both themes.

Two things worth knowing:

- **Reuse the `data-*` hooks.** The base stylesheet targets them directly — for
  example `#requests-table td[data-status=urgent]` bolds a whole cell, so the
  attribute has to be on the `<td>`, not only on the chip inside it. Your own new
  styles go in `web/src/styles/app.css`.
- **The mockup is a look reference, not a spec.** Keep the palette/type and the
  feel; lay out and structure the screen however serves the user. Existing route
  slugs stay as they are — the `NAV` in `web/src/layout/AppShell.jsx` is the
  single source for the sidebar order; new screens can be named freely.

## Adding styles

The base stylesheets are shared with the mockups and are treated as read-only:

- `styles/dugo.css` — the design system (palette, type, primitives).
- `styles/dugo.extras.css` — shared app-only hooks (overlays/toasts).

Anything new the app needs goes in **`web/src/styles/app.css`**, imported by
`web/src/main.jsx`. Keep selectors app-scoped, reuse the CSS custom properties the
base defines, and check the result in both themes.

## Tooling (`tools/`)

Python 3 scripts used to build this repo — **you do not need them to run or build
the app**. Two of them are the reason the design system exists, one seeded the
first page bodies, and the screenshot tool keeps this README in step with the
mockups. Only the last one needs dependencies beyond the standard library.

| Script | Purpose |
| --- | --- |
| `extract_design_system.py` | One-time **phase 1**: split the mockups' inline `<style>` into `styles/`, decode the fonts into `fonts/`, write `assets/favicon.png`. Verified lossless. |
| `refactor_mockups.py` | One-time **phase 2**: point the 20 mockups at `styles/dugo.css` instead of the inline block. Verified reversible. |
| `csslib.py` | Shared CSS parsing helpers for the two scripts above. |
| `htmltojsx.py` | Exact HTML → JSX converter (used by `gen_pages.py`). |
| `gen_pages.py` | The one-time scaffold that produced the first `DashboardBody.jsx`, `LandingBody.jsx` and `layout/shell.parts.txt` from the mockups. Those pages are now normal, editable source — you don't need to run this. |
| `screenshots.py` | Render every mockup to `docs/screenshots/` for this README. Needs a one-time `pip3 install --user playwright pillow` and `python3 -m playwright install chromium`. **Re-run it after changing any mockup**, or the README keeps showing the old reference. |

## Tech stack

- **App:** JavaScript (`.jsx`) with React 19, React Router 7, built by Vite 8.
- **Auth:** Firebase Authentication (`firebase` v13), configured from
  `web/.env.local` — optional, so the app also runs without it.
- **Mockups:** plain HTML + CSS + a little vanilla JavaScript, no build step.
- **Design system:** one hand-written stylesheet, split into section files that
  `dugo.css` imports in cascade order.
- **Tooling:** Python 3.

## Planned: the API

There is **no backend yet** — every screen renders from `web/src/services/`. When
the API exists it will live in its own repository, and this app will:

- replace the fixtures in `web/src/services/*` with a `web/src/api/` client,
- read the base URL from `VITE_API_URL` (baked in at build time, so one build per
  environment), and
- proxy `/api` to the backend in `vite.config.js` during development, which keeps
  CORS out of the way locally.

Because the screens are already data-driven, that swap should not require
rewriting the pages.

Two things that are stubbed against the API's arrival:

- **Roles are not persisted.** The role chosen on `/register` is presentational
  (see [Authentication](#authentication)); storing it needs a `users/{uid}`
  document or a custom claim, so the shell can show the real role instead of the
  demo label it shows today.
- **Nothing is fetched.** `/admin/blood-requests` reads `web/src/services/requests.js`
  as a stand-in for the response shape.

## License

No `LICENSE` file is included in this repository yet, so no license is granted by
default.
