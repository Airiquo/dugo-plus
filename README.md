# Dugo+

A blood bank and donor management web app: request blood, match donors, track
inventory, and record donations.

This repository holds both the **design** and the **app**:

| Folder | What it is |
| --- | --- |
| `light/`, `dark/` | Clickable HTML mockups — one file per screen, in both themes. These are the design source of truth. |
| `styles/` | The shared design system (CSS) used by the mockups **and** the app. |
| `web/` | The React app that implements the mockups. |
| `tools/` | Python scripts used to extract the design system and generate the app pages. |

The app is plain **JavaScript** (`.jsx` / `.js`) on **Vite + React** — there is no
TypeScript in this repository.

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
- `/gallery` — component gallery (handy while building new screens)

While the dev server is running, the mockups are also served from the same
origin, so you can compare side by side:

```
http://localhost:5173/mockups/light/admin-dashboard.html
```

### 3. Production build

```bash
cd web
npm run build     # writes web/dist/
npm run preview   # serves the built app locally
```

**Requirements:** Node `^20.19.0 || >=22.12.0` and npm. Python 3 is only needed
for the scripts in `tools/`.

## What works today

The design system and the app scaffolding are complete. Two screens are fully
translated so far:

| Route | Status |
| --- | --- |
| `/` | Landing page — complete React page |
| `/admin/dashboard` | Dashboard — faithful translation of `light/admin-dashboard.html` |
| `/admin/blood-requests`, `/admin/donor-matching`, `/admin/donor-registry`, `/admin/inventory`, `/admin/donations-rewards`, `/admin/reports`, `/admin/audit-trail`, `/admin/settings` | Placeholder page (`ScreenStub`) with a link to the live mockup |
| `/gallery` | Component gallery — every component rendered in both themes |
| anything else | Not found |

Translating one of the remaining screens means turning its mockup into a page
using the existing components (see [Translating a screen](#translating-a-mockup-into-a-page)).

## Project layout

```
.
├── index.html          # Index of all mockups (open this in a browser)
├── light/              # Light-theme mockups (10 screens)
├── dark/               # Dark-theme mockups (10 screens)
├── styles/             # Design system: dugo.css + the files it imports
│   └── dugo.extras.css # App-only additions (overlays, toasts, KPI row)
├── fonts/              # Self-hosted webfonts
├── assets/             # Shared assets (favicon)
├── tools/              # Python helpers (design-system extraction, HTML → JSX)
└── web/                # Vite + React app
    ├── index.html      # App entry point
    ├── vite.config.js  # Also serves the mockups at /mockups/*
    └── src/
        ├── main.jsx        # Entry: imports the shared stylesheet, mounts <App>
        ├── App.jsx         # Routes
        ├── theme.jsx       # Light/dark theme context (`useTheme`)
        ├── App.jsx             # Routes
        ├── main.jsx            # Entry point (imports the shared styles)
        ├── theme.jsx           # Theme context + `useTheme()`
        ├── layout/             # Admin shell (sidebar / topbar / main)
        ├── pages/              # Route pages (`DashboardBody` / `LandingBody` are generated)
        └── components/         # Reusable UI primitives + `CONVENTIONS.md`
```

## The design system at a glance

One stylesheet (`styles/dugo.css`) drives the mockups and the app. Almost all
state is expressed with **`data-*` attributes**, not new class names:

```jsx
<Chip data-status="urgent">urgent</Chip>
<Card id="kpi-active-requests" data-trend="up">24</Card>
<button className="tab" data-active="true">weekly</button>
```

`data-status=urgent` becomes red, `data-status=fulfilled` green, and so on —
the stylesheet maps attribute *values* to colours and states.

Two rules keep this stable:

- **Never edit `styles/*.css`.** They are extracted from the mockups and shared.
  The only file for app-only additions is `styles/dugo.extras.css`, and additions
  there should be generic and reusable.
- **Compose, don't re-style.** Build pages from `web/src/components` rather than
  adding classes or inline styles.

Some ids carry meaning too: overlays derive their ids from a `name`
(`<name>-modal`, `<name>-drawer`, `<name>-backdrop`) and KPI cards derive
`<name>-label` / `<name>-value` / `<name>-trend` / `<name>-chart`.

## Translating a mockup into a page

The remaining admin screens are all the same job. For example, *inventory*:

1. **Read the mockup** — `light/admin-inventory.html`.
2. **Read 2–3 similar implementations first** — `web/src/components/index.js`,
   `web/src/pages/Gallery.jsx`, and a translated page such as
   `web/src/pages/Dashboard.jsx`.
3. **Build the page** in `web/src/pages/` from the components, then wire the route
   in `web/src/App.jsx` (replacing the `ScreenStub` for that slug).
4. **Verify** — `cd web && npx vite build`, then compare against the mockup
   side by side (the mockup is served at `/mockups/light/…` by the dev server).

Route slugs match the mockup filenames (`/admin/inventory` →
`light/admin-inventory.html`).

Three short docs cover the details:

- `AGENTS.md` — the repo rules (read this first).
- `PROMPTING_GUIDE.md` — deeper guide: layout, naming, prompt templates.
- `web/src/components/CONVENTIONS.md` — the component patterns to copy.

## Tooling (`tools/`)

Python 3 scripts used to build this repo — you do not need them to run the app.

| Script | Purpose |
| --- | --- |
| `extract_design_system.py` | Extract the shared CSS from the mockups into `styles/`. |
| `refactor_mockups.py` | Point the mockups at the shared stylesheet. |
| `htmltojsx.py` | Convert HTML markup to JSX. |
| `gen_pages.py` | Generate the faithful page bodies (`DashboardBody.jsx`, `LandingBody.jsx`). Regenerating rewrites those files. |
| `inspect_html.py`, `analyze_selectors.py`, `dump_*.py`, `debug_conflicts.py` | Exploration and debugging helpers. |

## Tech stack

- **App:** JavaScript (`.jsx`) with React 19, React Router 7, built by Vite 8.
- **Mockups:** plain HTML + CSS + a little vanilla JavaScript, no build step.
- **Tooling:** Python 3.

## License

No `LICENSE` file is included in this repository yet, so no license is granted
by default.
