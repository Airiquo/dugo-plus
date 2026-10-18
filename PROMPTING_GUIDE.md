# Prompting Guide for Dugo+ (opencode)

This guide is written for an AI agent (opencode) working on the Dugo+ design
system and React app. The aim is to keep new UI **on-brand** (matching the look
and feel of the existing design) while giving the agent freedom over layout,
composition, and UX — and to avoid common context/token pitfalls.

## 1. Core Principles

- **Read, don't paste.** Point the agent to files (`path/to/file.jsx`) and tell it to *read* them. Never paste 30–40KB JSX into a prompt; it bloats context and hurts accuracy.
- **Brand first, not spec.** `styles/dugo.css` defines the visual language — palette, `data-*` state tones, typography, and how the primitives are styled. Match that language. The HTML mockups (`light/*.html`, `dark/*.html`) are a **style reference**, not a spec to reproduce.
- **Design the rest.** Page layout, information architecture, composition, new components, new screens, and UX flows are the agent's call. Do them well — don't bring in a foreign look, but don't be shy about improving the structure.
- **Compose or create.** Reach for `web/src/components/*` first. When the design needs something that doesn't exist, build a new primitive following `CONVENTIONS.md` and export it from the barrel.
- **Extend in `app.css`.** New CSS goes in `web/src/styles/app.css`. `styles/dugo.css` and `styles/dugo.extras.css` are the shared base — leave them alone.
- **Both themes.** Every new style works in light *and* dark.
- **Read, then build.** Read 2–3 similar components/pages before writing new code.

## 2. Key References

| What | Path | Purpose |
|---|---|---|
| Design system (base) | `styles/dugo.css` | The visual language: palette, type, `data-*` states, primitive styling |
| App stylesheet | `web/src/styles/app.css` | New/own styling for the app; imported by `main.jsx` |
| App CSS extras (base) | `styles/dugo.extras.css` | Shared app-only hooks (overlays/toasts). Don't load in mockups; don't edit |
| Component library | `web/src/components/index.js` | Barrel of reusable primitives |
| Components dir | `web/src/components/` | Implementations (Btn, Card, Table, Field, …) |
| Component conventions | `web/src/components/CONVENTIONS.md` | Patterns for components, new ones included |
| App shell | `web/src/layout/AppShell.jsx` | Sidebar/topbar + `#app-shell` structure |
| Theme hook | `web/src/hooks/useTheme.jsx` | `ThemeProvider`/`useTheme`; drives `[data-theme]` on `<html>` |
| Firebase config | `web/src/lib/firebase.js` | `VITE_FIREBASE_*` → `auth` / `googleProvider` (null when unset) |
| Auth service | `web/src/services/auth.js` | The only module importing the Firebase Auth SDK (+ `authErrorMessage`) |
| Auth hook | `web/src/hooks/useAuth.jsx` | `AuthProvider` / `useAuth()` session context built on the service |
| Data service | `web/src/services/requests.js` | Sample request data — the API shape pages render from |
| Class helper | `web/src/utils/cx.js` | `cx()` classnames join used by every component |
| Pages dir | `web/src/pages/` | Role folders: `admin/`, `donor/`, `hospital/`, `public/`, `shared/` |
| Auth gate | `web/src/layout/RequireAuth.jsx` | Guards `/admin/*` when a project is configured |
| Auth screens | `web/src/pages/public/Login.jsx`, `Register.jsx` | Built on `web/src/layout/AuthLayout.jsx` (public `.pub` chrome) |
| Dashboard | `web/src/pages/admin/Dashboard.jsx` + `DashboardBody.jsx` | Seeded from the mockup — editable |
| Landing | `web/src/pages/public/Landing.jsx` + `LandingBody.jsx` | Seeded from the mockup — editable |
| Gallery | `web/src/pages/shared/Gallery.jsx` | Usage examples for every component |
| Stubs | `web/src/pages/shared/ScreenStub.jsx` | Placeholder for a screen with nothing built yet |
| Routes | `web/src/App.jsx` | Route mapping |
| Style reference (dev) | `/mockups/light/*.html`, `/mockups/dark/*.html` | The look to stay close to |
| Vite config | `web/vite.config.js` | Serves mockups at `/mockups/*` |
| Agent rules | `AGENTS.md` | Global rules for this repo |

## 3. Prompt Structure (Use This Every Time)

```text
GOAL
[One clear sentence: what to build/change and why]

INPUTS
- Read: <file paths>
- Reference (optional): /mockups/light/<screen>.html — for the look, not to copy
- Reference usage: web/src/components/index.js, web/src/pages/shared/Gallery.jsx

CONSTRAINTS
- Use AppShell for admin screens. Landing must not use AppShell.
- Prefer components from web/src/components; create new primitives when the design needs them (read 2–3 similar ones first, follow CONVENTIONS.md, export from the barrel).
- Stay inside the locked look: existing palette, typography, and data-* state tones. Keep both themes working.
- New CSS only in web/src/styles/app.css. Don't edit styles/dugo.css or styles/dugo.extras.css.
- Forward arbitrary data-* props: always spread {...rest} last.
- Layout, IA, and UX are yours to design — the mockup is a reference, not a spec.
- Respect id-suffix conventions where you reuse overlays/KPI: <name>-modal/-drawer/-backdrop, <name>-label/-value/-trend/-chart.
- Follow the folder organization and naming conventions in this guide.

ACCEPTANCE CRITERIA
- Build passes: `cd web && npx vite build`
- Looks on-brand (palette/type/states) and works in both themes
- Composes existing components, or adds a documented new one (barrel updated)
- Route wired correctly in web/src/App.jsx
- No unused imports/vars, no console errors

OUTPUT INSTRUCTIONS
- Show the file(s) created/modified with full paths.
- List any assumptions made.
- Run the verification commands and report results.
```

## 4. Folder Organization & Naming Conventions

Keep the repo predictable and low-context to minimize cost.

### 4.1 Root Structure
```
dugo-plus/
├── AGENTS.md           # Global agent rules
├── light/              # HTML mockups (light theme) — style reference
├── dark/               # HTML mockups (dark theme) — style reference
├── styles/             # Shared base CSS (dugo.css + dugo.extras.css)
├── fonts/              # Self-hosted fonts
├── assets/             # Shared assets (favicon)
├── tools/              # Extraction/conversion utilities
└── web/                # Vite + React app
```

### 4.2 `web/src/` Organization
```
web/src/
├── components/         # Reusable UI primitives (atomic + composed)
│   ├── *.jsx           # Component files (PascalCase)
│   ├── index.js        # Barrel export
│   └── CONVENTIONS.md  # Component patterns
├── styles/
│   └── app.css         # App-owned styling (new UI lives here)
├── layout/             # App chrome/layout shells
│   ├── AppShell.jsx    # Admin shell (sidebar/topbar/main)
│   ├── RequireAuth.jsx # /admin/* gate (passes through when unconfigured)
│   ├── AuthLayout.jsx  # Public `.pub` chrome for the auth screens
│   └── shell.parts.txt # Reference material (generated)
├── pages/              # Route-level pages, grouped by role
│   ├── admin/          # The admin account type
│   │   ├── BloodRequests.jsx  # Worked example: a list screen from components
│   │   ├── Dashboard.jsx
│   │   └── DashboardBody.jsx  # Seeded from the mockup — editable
│   ├── donor/          # Donor screens (README; none built yet)
│   ├── hospital/       # Hospital/Blood Bank screens (README; none yet)
│   ├── public/         # Role-agnostic entry
│   │   ├── Landing.jsx, LandingBody.jsx  # Seeded from the mockup — editable
│   │   ├── Login.jsx       # Sign in (layout/AuthLayout.jsx, no role picker)
│   │   ├── Register.jsx    # Create an account (?role= presets the account type)
│   │   └── NotFound.jsx
│   └── shared/         # ScreenStub (not built yet) + Gallery (component usage)
├── hooks/              # React context/hooks
│   ├── useTheme.jsx    # ThemeProvider/useTheme
│   └── useAuth.jsx     # AuthProvider/useAuth (session over services/auth)
├── services/           # Data + external access
│   ├── auth.js         # Only module importing the Firebase Auth SDK
│   └── requests.js     # Sample data fixtures (the shape the API should return)
├── lib/                # Third-party setup
│   └── firebase.js     # Firebase config from VITE_FIREBASE_* (null when unset)
├── utils/              # Framework-free helpers
│   └── cx.js           # Classnames join used by every component
├── App.jsx             # Routes
└── main.jsx            # Entry point (imports base styles + app.css)
```

### 4.3 Naming Conventions

| Type | Convention | Examples | Notes |
|---|---|---|---|
| **Components** | `PascalCase.jsx` | `Btn.jsx`, `Card.jsx`, `KpiCard.jsx` | One component per file (or tightly-coupled pair). |
| **Pages** | `PascalCase.jsx` | `admin/Dashboard.jsx`, `shared/Gallery.jsx` | Route-level, grouped by role. Default export. |
| **Hooks** | `camelCase.jsx` | `hooks/useTheme.jsx`, `hooks/useAuth.jsx` | One context + hook per file. |
| **Services/Lib** | `camelCase.js` | `services/auth.js`, `lib/firebase.js` | External/data access; no React. |
| **Utils** | `camelCase.js` | `utils/cx.js` | Framework-free helpers. |
| **Prop contracts** | JSDoc above the component | `/** `name`: base id … */`, `@param` only when it helps | Plain JS — no type exports. |
| **Barrel** | `index.js` | `web/src/components/index.js` | Re-export only public primitives. Keep stable names. |
| **CSS** | `kebab-case.css` | `app.css`, `dugo.css` | Base files aren't edited; new styling goes in `app.css`. |
| **Filenames match export** | Yes | `KpiCard.jsx` exports `KpiCard`/`KpiRow` | Clear discoverability, low cost. |
| **Route slugs** | `kebab-case` | `/admin/blood-requests`, `/admin/donor-matching` | Keep existing slugs; new routes are free. |
| **Mockup references** | `kebab-case` | `light/admin-inventory.html` | Never rename mockups. |

### 4.4 Component Organization Rules

- **Reuse first, then build:** Prefer an existing primitive. When the design needs a new one, add it to `components/` — that's expected, not discouraged.
- **Atomic first:** Small, single-purpose primitives (`Icon`, `Btn`, `Chip`, `Badge`, `Pill`, `Field`, `Tabs`) live in `components/`.
- **Composed, not duplicated:** `KpiCard` composes `Card` + `Chip` + `Sparkline`. `Table` composes `<table>` + optional `.table-scroll`.
- **Forward `data-*`:** Every component that renders a DOM element **must** accept arbitrary `data-*`/HTML props and spread `{...rest}` to its root element (last, so caller overrides). See `CONVENTIONS.md`.
- **Id-suffix discipline:** `Modal/Drawer` derive ids from `name` (`${name}-modal`, `${name}-drawer`, `${name}-backdrop`). `KpiCard` derives ids (`${name}-label/-value/-trend/-chart`).
- **No side effects on import:** Components must be pure. Avoid mutating globals.
- **Keep barrel minimal:** Only export what's intended for reuse. Internal helpers stay file-local.
- **Stay on-brand:** Reuse the base classes and `data-*` hooks rather than duplicating them; new visual styles go in `app.css`.

### 4.5 Page Organization Rules

- **Role folders:** Pages live in the role folder that owns them (`admin/`, `donor/`, `hospital/`); landing/auth/not-found go in `public/`, and shared non-route pages (ScreenStub, Gallery) in `shared/`.
- **Shelling:** Admin pages are wrapped in `<AppShell>`. Landing does **not** use AppShell.
- **Stubs:** A screen with nothing built yet uses `ScreenStub` (links the reference mockup). Building it = replace the stub with a real page and wire the route.
- **Route mapping:** Add routes in `App.jsx`. Keep the mapping consistent with `NAV` in `AppShell`.
- **Co-locate minimal logic:** Page-specific state/handlers live in the page component. Reusable logic moves to components or small hooks (`hooks/useTheme.jsx` style).
- **Design freely:** The mockup is a look-and-feel reference. Improve the layout, tighten the flow, and structure the page however serves the user best.

### 4.6 Style/CSS Rules

- **Base is fixed:** `styles/dugo.css` and `styles/dugo.extras.css` are the shared base — do not edit them.
- **App styling in `app.css`:** All new CSS goes in `web/src/styles/app.css`, imported by `main.jsx`. Keep selectors app-scoped and reusable.
- **Data-driven:** Reuse the `data-*` attributes the stylesheet already maps to states/colors before inventing new ones.
- **Both themes:** Verify new styling in light and dark.
- **Palette/type locked:** Don't introduce new brand colours or fonts; compose from what exists.

## 5. Prompt Templates (Copy-Paste Ready)

### 5.1 Design a screen (mockup as reference)

```text
GOAL
Design web/src/pages/admin/Inventory.jsx for /admin/inventory. Use
light/admin-inventory.html and dark/admin-inventory.html as the look reference;
the layout and flow are yours, but it must feel like the same product.

INPUTS
- Read: web/src/layout/AppShell.jsx, web/src/components/index.js, web/src/components/CONVENTIONS.md, web/src/pages/shared/Gallery.jsx, web/src/pages/admin/BloodRequests.jsx (worked example), web/src/services/requests.js (data shape)
- Reference: /mockups/light/admin-inventory.html and /mockups/dark/admin-inventory.html
- Stub currently renders for /admin/inventory (see web/src/App.jsx)

CONSTRAINTS
- Admin screen → wrap in <AppShell> with the page-header/title/actions pattern.
- Read 2–3 similar components before composing (Card, Table, Tabs, Field, Btn).
- Prefer Card, Btn, Field/Input/Select, Tabs, Table, PageHeader, Chip/Badge/Pill, DotMeter/DotRow/DotColumns/Sparkline/Radar.
- Stay inside the palette/type/data-* states; do not add new brand colours.
- New styles (if needed) go in web/src/styles/app.css.
- Forward data-* and spread {...rest} last.
- Follow the folder/naming conventions above.

ACCEPTANCE CRITERIA
- web/src/pages/admin/Inventory.jsx created and exported as default (PascalCase)
- /admin/inventory renders it (update App.jsx, drop the stub)
- cd web && npx vite build passes
- Reads as the same product as light/admin-inventory.html (look), improved where it helps (layout)
- Works in both themes; no unused imports/vars

OUTPUT INSTRUCTIONS
- Read the required files first.
- Show the new Inventory.jsx (full path) and any App.jsx / app.css change.
- Run verification and report PASS/FAIL with command output.
```

### 5.2 Create a reusable component

```text
GOAL
Create web/src/components/{{name}}.jsx to encapsulate [pattern]. Keep it
generic: it should be reusable across screens and themes.

INPUTS
- Read: web/src/utils/cx.js, web/src/components/index.js, web/src/components/CONVENTIONS.md, web/src/pages/shared/Gallery.jsx
- Closest matches: [list 2–3: e.g. Card.jsx, Btn.jsx]
- Look reference: /mockups/light/<file>.html (for the visual language only)

CONSTRAINTS
- Mimic the closest existing components for props, cx usage, rest order, and data-* forwarding.
- Accept arbitrary data-* + standard HTML props; forward {...rest} last.
- Use cx() from '../utils/cx'. Reuse base class names; add new styles in app.css if needed.
- Export from components/index.js. PascalCase filename matching the export.
- Stay on-brand: reuse existing tokens/classes and data-* hooks.

ACCEPTANCE CRITERIA
- Component documented in JSDoc, forwards rest/data-*, no unused imports
- Added to the barrel export
- Shown in Gallery.jsx (minimal example)
- cd web && npx vite build passes
- Works in both themes; visually consistent with existing primitives

OUTPUT INSTRUCTIONS
- Show the component file + barrel change + Gallery addition (full paths)
- Explain which components were mimicked and why
- Run verification and report results
```

### 5.3 Improve or fix UI

```text
GOAL
[Improve / fix] [specific thing] on [route/page] so it feels right and stays
on-brand. (If a mockup exists, use it as the look reference — not a target.)

INPUTS
- Read: web/src/pages/<Page>.jsx, web/src/components/index.js, web/src/components/CONVENTIONS.md
- Look reference: /mockups/light/<screen>.html (optional)

CONSTRAINTS
- Prefer composing/creating components over ad-hoc markup.
- Stay inside the existing palette/type/data-* states; keep both themes working.
- New CSS only in web/src/styles/app.css.
- Keep changes focused; don't refactor unrelated code.

ACCEPTANCE CRITERIA
- The change reads as on-brand and works in both themes
- cd web && npx vite build passes
- No unused imports/vars, no regressions

OUTPUT INSTRUCTIONS
- Show the changed file(s) (full paths) and run the build.
```

## 6. The Rules Files

The rules live in the repo — read them rather than copying:

- **`AGENTS.md`** — the golden rule, the locked-vs-free table, and the folder/auth/styling rules.
- **`web/src/components/CONVENTIONS.md`** — the concrete component patterns (A: button-like, B: surface-like, C: inline/status-like) and the rules around them.

Keep those two files as the single source of truth; this guide references them
instead of duplicating them so they can't drift.
