# Dugo+

A blood bank and donor management web app: request blood, match donors, track
inventory, and record donations.

The design lives in this repository together with the app, and both run off the
same stylesheet — so the mockups and the app cannot drift apart.

| Folder | What it is |
| --- | --- |
| `light/`, `dark/` | Clickable HTML mockups — one file per screen, in both themes. These are the design source of truth. |
| `styles/` | The shared design system (CSS), consumed by the mockups **and** the app. |
| `web/` | The React app that implements the mockups. |
| `tools/` | Python scripts that produced `styles/` and the generated page bodies. Not needed to run the app. |

The app is plain **JavaScript** (`.jsx` / `.js`) on **Vite + React** — there is no
TypeScript in this repository.

## How the repo fits together

```
light/*.html, dark/*.html     the design source of truth — 20 mockups, 10 screens
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

- **The mockups and the app share one stylesheet**, so a screen looks the same in
  both and a CSS fix applies to both.
- **`web/` reads `../styles`, `../fonts` and `../assets` by relative path.** That
  is why the app lives *inside* this repository rather than in its own.
- **The mockups are the source of truth.** The app is a translation of them; when
  they disagree, the mockup wins.

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
- `/admin/dashboard` — admin dashboard
- `/admin/blood-requests` — blood requests list
- `/gallery` — every component, in both themes (handy while building screens)

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

The design system is complete and every screen exists as a mockup. Three pages
are translated into React so far:

| Route | Status |
| --- | --- |
| `/` | Landing page — translated |
| `/admin/dashboard` | Dashboard — translated |
| `/admin/blood-requests` | Blood requests list — translated, renders from `web/src/data/requests.js` |
| `/admin/donor-matching`, `/admin/donor-registry`, `/admin/inventory`, `/admin/donations-rewards`, `/admin/reports`, `/admin/audit-trail`, `/admin/settings` | Placeholder (`ScreenStub`) with a link to the live mockup |
| `/gallery` | Component gallery — every component rendered in both themes |
| anything else | Not found |

The remaining work is one screen at a time — see
[Building a screen](#building-a-screen).

## Where to start

Four documents, in the order you should read them:

| Doc | Contents |
| --- | --- |
| `AGENTS.md` | The repo rules. Read this first — it is short and load-bearing. |
| `PROMPTING_GUIDE.md` | Structure, naming, and prompt templates for building a screen. |
| `web/src/components/CONVENTIONS.md` | The three component patterns to copy, and the rules around them. |
| `web/src/pages/Gallery.jsx` | Working examples of every component — the fastest way to see how to use one. |

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
├── tools/                  # Python helpers — build-time only
└── web/                    # Vite + React app
    ├── index.html          # App entry point
    ├── vite.config.js      # Also serves the mockups at /mockups/*
    └── src/
        ├── main.jsx        # Entry: imports the shared stylesheet, mounts <App>
        ├── App.jsx         # Routes (translated slugs vs ScreenStub)
        ├── theme.jsx       # Light/dark theme context (`useTheme`)
        ├── layout/         # Admin shell (sidebar / topbar / main)
        ├── pages/          # Route pages
        │   ├── BloodRequests.jsx  # Worked example: a list screen from components
        │   ├── Dashboard.jsx      # Wraps the generated DashboardBody
        │   ├── DashboardBody.jsx  # GENERATED — do not hand-tidy
        │   └── LandingBody.jsx    # GENERATED — do not hand-tidy
        ├── data/           # Sample data (the shape the API is expected to return)
        └── components/     # Reusable UI primitives + CONVENTIONS.md
```

## The design system at a glance

One stylesheet (`styles/dugo.css`) drives the mockups and the app. Almost all
state is expressed with **`data-*` attributes**, not new class names:

```jsx
<Chip data-status="urgent">urgent</Chip>
<Card id="kpi-active-requests" data-trend="up">24</Card>
<button className="tab" data-active={active}>weekly</button>
```

`data-status=urgent` becomes red, `data-status=fulfilled` green, and so on — the
stylesheet maps attribute *values* to colours and states. Because the attributes
sit on the real elements, the same markup styles itself in both themes.

Two rules keep this stable:

- **Never edit `styles/*.css`.** They were extracted from the mockups verbatim and
  are shared. The only file for app-only additions is `styles/dugo.extras.css`,
  and additions there should be generic and reusable.
- **Compose, don't re-style.** Build pages from `web/src/components` rather than
  adding classes or inline styles.

Some ids carry meaning too: overlays derive their ids from a `name`
(`<name>-modal`, `<name>-drawer`, `<name>-backdrop`) and KPI cards derive
`<name>-label` / `<name>-value` / `<name>-trend` / `<name>-chart`.

## Building a screen

Every remaining admin screen is the same job. Take the smallest one first — the
screen sizes are roughly `settings` (4 KB) → `donor-registry` (7 KB) →
`blood-requests` (8 KB, done) → `audit-trail` → `reports` → `donations-rewards`
→ `donor-matching` → `inventory` (21 KB).

1. **Read the mockup** — `light/<screen>.html`, and `dark/<screen>.html` to check
   the dark theme.
2. **Read a worked example first** — `web/src/pages/BloodRequests.jsx` (a list
   screen end to end), `web/src/pages/Gallery.jsx` (every component in use), and
   `web/src/data/requests.js` (how the data is shaped).
3. **Build the page** in `web/src/pages/` by composing the components, then add
   the slug to `TRANSLATED` in `web/src/App.jsx` so the route stops rendering the
   `ScreenStub`.
4. **Verify** — `cd web && npx vite build` must pass, then compare against the
   mockup side by side at `/mockups/light/<screen>.html`.

Two things worth knowing:

- **Match ids and `data-*` exactly.** The stylesheet targets them directly — for
  example `#requests-table td[data-status=urgent]` bolds a whole cell, so the
  attribute has to be on the `<td>`, not only on the chip inside it.
- **Route slugs match mockup filenames** (`/admin/blood-requests` →
  `light/admin-blood-requests.html`), and the `NAV` in `web/src/layout/AppShell.jsx`
  is the single source for the sidebar order.

## Tooling (`tools/`)

Python 3 scripts used to build this repo — **you do not need them to run or build
the app**. They are kept because two of them are the reason the design system and
the generated pages exist, and because the converter is a useful check.

| Script | Purpose |
| --- | --- |
| `extract_design_system.py` | One-time **phase 1**: split the mockups' inline `<style>` into `styles/`, decode the fonts into `fonts/`, write `assets/favicon.png`. Verified lossless. |
| `refactor_mockups.py` | One-time **phase 2**: point the 20 mockups at `styles/dugo.css` instead of the inline block. Verified reversible. |
| `csslib.py` | Shared CSS parsing helpers for the two scripts above. |
| `htmltojsx.py` | Exact HTML → JSX converter (used by `gen_pages.py`). |
| `gen_pages.py` | Generate `DashboardBody.jsx`, `LandingBody.jsx` and `layout/shell.parts.txt` from the mockups. **Running it rewrites those files** — they are checked in, and regenerating must reproduce them byte for byte apart from edits to the generator itself. |

**Using the converter as a parity check.** Because the conversion is exact and
deterministic, you can render a screen and diff its structure against the mockup
to prove you did not drop an id or a `data-*` attribute:

```bash
python3 tools/gen_pages.py      # regenerate, then `git diff web/src/pages`
```

## Tech stack

- **App:** JavaScript (`.jsx`) with React 19, React Router 7, built by Vite 8.
- **Mockups:** plain HTML + CSS + a little vanilla JavaScript, no build step.
- **Design system:** one hand-written stylesheet, split into section files that
  `dugo.css` imports in cascade order.
- **Tooling:** Python 3.

## Planned: the API

There is **no backend yet** — every screen renders from `web/src/data/`. When the
API exists it will live in its own repository, and this app will:

- replace `web/src/data/*` with requests in a `web/src/api/` client,
- read the base URL from `VITE_API_URL` (baked in at build time, so one build per
  environment), and
- proxy `/api` to the backend in `vite.config.js` during development, which keeps
  CORS out of the way locally.

Because the screens are already data-driven, that swap should not require
rewriting the pages.

## License

No `LICENSE` file is included in this repository yet, so no license is granted by
default.
