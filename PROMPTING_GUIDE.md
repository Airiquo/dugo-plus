# Prompting Guide for Dugo+ (opencode)

This guide is written for an AI agent (opencode) working on the Dugo+ design system and React app. It explains how to write prompts that keep the UI visually identical to the mockups, reuse the existing system, and avoid common context/token pitfalls.

## 1. Core Principles

- **Read, don't paste.** Point the agent to files (`path/to/file.jsx`) and tell it to *read* them. Never paste 30–40KB generated JSX into a prompt; it bloats context and hurts accuracy.
- **Ground truth first.** Treat the HTML mockups (`light/*.html`, `dark/*.html`) as the source of visual truth. Treat `styles/dugo.css` as the source of styling truth.
- **Reuse, don't reinvent.** Prefer `web/src/components/*` over raw HTML/class soup. New UI should compose existing primitives and forward `data-*` attributes.
- **Stay faithful.** Don't refactor class names, restructure markup unnecessarily, or change spacing. Small structural tweaks are only allowed if they preserve the rendered appearance.
- **Verify, don't assume.** Every non-trivial change must pass the build. Visual parity is enforced by comparing against the mockup (`/mockups/light/*` in dev).
- **Narrow scope wins.** One screen/component per prompt. Avoid "translate the whole app" or multi-screen requests in a single turn.
- **Mimic before creating.** Always find and read 1–3 existing, similar implementations before creating anything new.

## 2. Key References (Point to These)

Use these exact paths in your prompts to anchor the agent to the right context:

| What | Path | Purpose |
|---|---|---|
| Design system CSS | `styles/dugo.css` | Single source of truth (classes, tokens, `data-*` hooks) |
| React app CSS extras | `styles/dugo.extras.css` | App-only generic hooks (overlays/toasts). Do **not** load in HTML mockups. |
| Component library | `web/src/components/index.js` | Barrel showing all reusable primitives |
| Components dir | `web/src/components/` | Implementation of primitives (Btn, Card, Table, Field, etc.) |
| Component conventions | `web/src/components/CONVENTIONS.md` | Required patterns for new components |
| App shell | `web/src/layout/AppShell.jsx` | Sidebar/topbar + `#app-shell` structure |
| Theme | `web/src/theme.jsx` | Drives `[data-theme]` on `<html>` |
| Faithful dashboard | `web/src/pages/DashboardBody.jsx` | Generated body — do not edit; regenerate with `tools/gen_pages.py` |
| Faithful landing | `web/src/pages/LandingBody.jsx` | Landing translation reference |
| Gallery | `web/src/pages/Gallery.jsx` | Canonical usage examples for every component |
| Stubs | `web/src/pages/ScreenStub.jsx` | Pattern for untranslated admin screens |
| Routes | `web/src/App.jsx` | Route mapping |
| Live mockups (dev) | `/mockups/light/*.html`, `/mockups/dark/*.html` | Compare side-by-side while developing |
| Vite config | `web/vite.config.js` | Serves mockups at `/mockups/*` |
| Agent rules | `AGENTS.md` | Global rules for this repo |

## 3. Prompt Structure (Use This Every Time)

Structure your prompts with these sections. It keeps the agent constrained and produces deterministic output.

```text
GOAL
[One clear sentence: what to build/change and why]

INPUTS (GROUND TRUTH)
- Read: <file paths>
- Reference mockup: /mockups/light/<screen>.html (and dark if relevant)
- Reference usage: web/src/components/index.js, web/src/pages/Gallery.jsx

CONSTRAINTS
- Use AppShell for admin screens. Landing must not use AppShell.
- Use components from web/src/components only (create new primitives only if none exist; document why).
- **Before creating a new component:** Read at least 2–3 similar components from web/src/components/ and follow CONVENTIONS.md.
- Preserve class names, IDs, data-* attributes, and visual structure. Do not rename semantic classes.
- Forward arbitrary data-* props (stylesheet is data-attribute driven). Always spread {...rest} after data-attrs.
- No changes to styles/*.css (verbatim). Only add to styles/dugo.extras.css if there's a generic, reusable gap — explain first.
- New screens compose the components in web/src/components (see Gallery.jsx for usage) — do not hand-copy mockup markup. Only DashboardBody.jsx/LandingBody.jsx are generated; never hand-tidy their inline spacing, and if they must change, edit tools/gen_pages.py and regenerate.
- Respect id-suffix conventions: modals/drawers/backdrops use <name>-modal/-drawer/-backdrop; KPI cards use <name>-label/-value/-trend/-chart and live inside #dashboard-kpi-row (or KpiRow).
- Follow folder organization and naming conventions in this guide.
- No hand-tweaks that change cascade order or introduce new global styles.

ACCEPTANCE CRITERIA
- Build passes: `cd web && npx vite build`
- Visually matches the mockup at /mockups/light/<screen>.html (structure, spacing, states)
- Uses existing components where applicable (no unnecessary duplication)
- Route wired correctly (replace stub or add route per App.jsx pattern)
- No unused imports/vars, no console errors
- Barrel export updated if a new component was added

OUTPUT INSTRUCTIONS
- Show the file(s) created/modified with full paths.
- List any assumptions made.
- Run the verification commands and report results.
```

## 4. Folder Organization & Naming Conventions

Keep the repo predictable and low-context to minimize cost. Follow these rules strictly.

### 4.1 Root Structure
```
dugo-plus/
├── AGENTS.md           # Global agent rules (see §6)
├── light/              # HTML mockups (light theme)
├── dark/               # HTML mockups (dark theme)
├── styles/             # Shared CSS (verbatim extraction + extras)
├── fonts/              # Self-hosted fonts
├── assets/             # Shared assets (favicon)
├── tools/              # Extraction/conversion utilities
└── web/                # Vite + React app
```

### 4.2 `web/src/` Organization
```
web/src/
├── components/         # Reusable UI primitives (atomic + composed)
│   ├── types.js        # Shared helper (cx); document prop contracts in JSDoc
│   ├── *.jsx           # Component files (PascalCase)
│   ├── index.js        # Barrel export
│   └── CONVENTIONS.md  # Component patterns
├── layout/             # App chrome/layout shells
│   ├── AppShell.jsx    # Admin shell (sidebar/topbar/main)
│   └── shell.parts.txt # Reference material (generated)
├── pages/              # Route-level pages
│   ├── *.jsx           # Page components (PascalCase, default export)
│   ├── BloodRequests.jsx  # Worked example: a list screen built from components
│   ├── DashboardBody.jsx  # Generated faithful body (do not hand-tidy)
│   └── LandingBody.jsx    # Generated faithful body (do not hand-tidy)
├── data/               # Sample data fixtures (the shape the API is expected to return)
├── App.jsx             # Routes
├── main.jsx            # Entry point (imports styles)
└── theme.jsx           # Theme context/hook
```

### 4.3 Naming Conventions

| Type | Convention | Examples | Notes |
|---|---|---|---|
| **Components** | `PascalCase.jsx` | `Btn.jsx`, `Card.jsx`, `KpiCard.jsx` | One component per file (or tightly-coupled pair). |
| **Pages** | `PascalCase.jsx` | `Dashboard.jsx`, `Gallery.jsx`, `ScreenStub.jsx` | Route-level. Default export. |
| **Hooks/Utils** | `camelCase.js` | `theme.jsx` has `useTheme()`; keep small helpers in `components/types.js` | Avoid over-abstracting. Prefer colocated helpers. |
| **Prop contracts** | JSDoc above the component | `/** `name`: base id … */`, `@param` only when it helps | Plain JS — no type exports. |
| **Barrel** | `index.js` | `web/src/components/index.js` | Re-export only public primitives. Keep stable names. |
| **CSS** | `kebab-case.css` | `dugo.css`, `dugo.extras.css` | Verbatim files stay untouched unless justified. |
| **Filenames match export** | Yes | `KpiCard.jsx` exports `KpiCard`/`KpiRow` | Clear discoverability, low cost. |
| **Route slugs** | `kebab-case` | `/admin/blood-requests`, `/admin/donor-matching` | Match mockup filenames (`admin-blood-requests.html`). |
| **Mockup references** | `kebab-case` | `light/admin-inventory.html` | Never rename mockups. |

### 4.4 Component Organization Rules

- **Atomic first:** Small, single-purpose primitives (`Icon`, `Btn`, `Chip`, `Badge`, `Pill`, `Field`, `Tabs`) live in `components/`.
- **Composed, not duplicated:** `KpiCard` composes `Card` + `Chip` + `Sparkline`. `Table` composes `<table>` + optional `.table-scroll`.
- **Forward `data-*`:** Every component that renders a DOM element **must** accept arbitrary `data-*`/HTML props and spread `{...rest}` to its root element (last, so caller overrides). See `CONVENTIONS.md`.
- **Id-suffix discipline:** `Modal/Drawer` derive ids from `name` (`${name}-modal`, `${name}-drawer`, `${name}-backdrop`). `KpiCard` derives ids (`${name}-label/-value/-trend/-chart`).
- **No side effects on import:** Components must be pure. Avoid mutating globals.
- **Keep barrel minimal:** Only export what's intended for reuse. Internal helpers stay file-local.
- **Single source of truth for styling:** Never add `className` that duplicates what `dugo.css` already provides. Use `data-*` hooks.

### 4.5 Page Organization Rules

- **Faithful first:** `DashboardBody.jsx`/`LandingBody.jsx` are **generated** and marked "do not hand-tidy". Do not reformat them.
- **Shelling:** Admin pages must be wrapped in `<AppShell>`. Landing must **not** use AppShell.
- **Stubs:** Untranslated admin screens use `ScreenStub` (shows live mockup links). Translating = replace stub with real page + wire route.
- **Route mapping:** Add routes in `App.jsx`. Keep slug mapping consistent with `NAV` in `AppShell`.
- **Co-locate minimal logic:** Page-specific state/handlers live in the page component. Reusable logic moves to components or small hooks in `theme.jsx` style.

### 4.6 Style/CSS Rules

- **Verbatim:** `styles/*.css` except `dugo.extras.css` are extracted verbatim. **Do not edit** them unless the extraction/verification explicitly requires it (document rationale).
- **App-only extras:** `styles/dugo.extras.css` is additive and loaded only by the React app (`main.jsx`). It provides generic hooks (overlays/toasts, `.kpi-row` alias). Propose additions only if generic + reusable.
- **Data-driven:** Prefer `data-*` attributes over new class names. The stylesheet maps attribute values to states/colors.
- **Id-scoped layout:** Respect id-scoped rules (`#dashboard-kpi-row`, etc.). Reuse via `KpiRow` or mirror ids only when necessary.

## 5. Prompt Templates (Copy-Paste Ready)

### 5.1 Translate an untranslated admin screen

```text
GOAL
Translate light/admin-inventory.html to a faithful React page at web/src/pages/Inventory.jsx, using AppShell and the component library. Replace the corresponding stub route (/admin/inventory).

INPUTS (GROUND TRUTH)
- Read: web/src/layout/AppShell.jsx, web/src/components/index.js, web/src/components/CONVENTIONS.md, web/src/pages/Gallery.jsx, web/src/pages/ScreenStub.jsx, web/src/pages/BloodRequests.jsx (worked example), web/src/data/requests.js (data shape)
- Reference mockup: /mockups/light/admin-inventory.html and /mockups/dark/admin-inventory.html
- Existing stub: ScreenStub renders for /admin/inventory (see web/src/App.jsx)

CONSTRAINTS
- Admin screen → wrap in <AppShell>. Match the page-header/title/actions and #page-body structure exactly.
- Before coding: read 2–3 components similar to the patterns used (Card, Table, Tabs, Field, Btn).
- Prefer components: Card, CardHeader, Btn, Field/Input/Select, Tabs, Table, PageHeader, Chip/Badge/Pill, DotMeter/DotRow/DotColumns/Sparkline/Radar where applicable.
- Forward all data-* attributes. Do not strip them. Spread {...rest} after data-attrs.
- Preserve IDs exactly where they exist (important for CSS targeting).
- Follow folder/naming conventions above.
- Do not modify styles/*.css.

ACCEPTANCE CRITERIA
- web/src/pages/Inventory.jsx created and exported as default (PascalCase)
- Route /admin/inventory renders Inventory (update App.jsx if needed)
- cd web && npx vite build passes
- Structure/spacing matches /mockups/light/admin-inventory.html
- No unused imports/vars

OUTPUT INSTRUCTIONS
- Read the required files first.
- Show the new Inventory.jsx (full path) and any App.jsx change.
- Run verification and report PASS/FAIL with command output.
```

### 5.2 Create or extend a reusable component

```text
GOAL
Create web/src/components/{{name}}.jsx (or extend existing) to encapsulate the [pattern] used in [mockup]. Keep it generic and reusable.

INPUTS
- Read: web/src/components/types.js, web/src/components/index.js, web/src/components/CONVENTIONS.md, web/src/pages/Gallery.jsx
- Closest matches: [list 2–3: e.g. Card.jsx, Btn.jsx]
- Extract representative markup from: /mockups/light/<file>.html

CONSTRAINTS
- Mimic closest matches: props typing, cx usage, rest spread order ({...rest} last), data-* forwarding, element choices.
- Props: accept arbitrary `data-*` + standard HTML props; forward `{...rest}` (last).
- Use `cx()` from `./types`. Never rename base class names.
- Export from `components/index.js`.
- Follow PascalCase filename matching export.
- No changes to styles/*.css.

ACCEPTANCE CRITERIA
- Component documented in JSDoc, forwards rest/data-*, no unused imports
- Added to barrel export
- Demonstrated in Gallery.jsx (minimal example)
- cd web && npx vite build passes
- Visually consistent with existing primitives

OUTPUT INSTRUCTIONS
- Show component file + barrel change + Gallery addition (full paths)
- Explain which components were mimicked and why
- Run verification and report results
```

### 5.3 Fix a visual/style mismatch

```text
GOAL
Fix [specific mismatch] on [route/page] so it matches /mockups/light/<screen>.html exactly.

INPUTS
- Read: web/src/pages/<Page>.jsx, web/src/components/index.js, web/src/components/CONVENTIONS.md, styles/dugo.css
- Compare against: /mockups/light/<screen>.html (inspect exact element id/class)
- Closest component: [if component-related, read it]

CONSTRAINTS
- Prefer fixing JSX/props (missing data-*, wrong element, missing wrapper) before CSS.
- If CSS change necessary: propose ONLY minimal additive addition to styles/dugo.extras.css with clear justification. Do not edit verbatim styles/*.css.
- Preserve fidelity. No unrelated refactors.

ACCEPTANCE CRITERIA
- Visual parity for target element/state
- Build passes: `cd web && npx vite build`
- No regression to other pages

OUTPUT INSTRUCTIONS
- Root cause + minimal diff (file + line ranges)
- Verification results
```

## 6. AGENTS.md (Global Rules) — Create This Once

Create `AGENTS.md` at the repo root with these rules. opencode reads this for every session.

```markdown
# AGENTS.md — Dugo+ Repo Rules

## Golden Rule
**Mimic, don't invent.** Before creating/editing, read the nearest existing implementation and follow its exact pattern.

## Component Rules
- Components live in `web/src/components/` (PascalCase). Export from `components/index.js`.
- Props: accept arbitrary `data-*` + standard HTML props; forward `{...rest}` to root (last).
- Use `cx()` from `./types`. Never add new base CSS classes.
- Modals/drawers: use `name` to derive `-modal/-drawer/-backdrop`. KPI: use `name` to derive `-label/-value/-trend/-chart`.
- Respect stylesheet hooks: `.card`, `.btn`, `.chip`, `.badge`, `.pill`, `.field`, `.table`, `.tabs`, etc. Don't rename.
- No changes to `styles/*.css` verbatim. Only `styles/dugo.extras.css` for generic, reusable hooks (justify first).

## Page Rules
- Admin pages → `<AppShell>`. Landing → no AppShell.
- Faithful bodies (`DashboardBody.jsx`, `LandingBody.jsx`) are generated — do not reformat.
- Untranslated screens → `ScreenStub`. Translating replaces stub + wires route in `App.jsx`.
- Route slugs must match mockup filenames (`admin-*.html`).

## Folder/Organization Rules
- Follow §4 of PROMPTING_GUIDE.md. Keep structure flat and predictable.
- PascalCase for components/pages. camelCase for hooks/utils. kebab-case for slugs/filenames where existing.
- One concern per file. Barrel exports minimal/stable.

## Verification
- `cd web && npx vite build`
- Compare against `/mockups/light/<target>.html` for visual parity.

## Cost/Context Rules
- Read files, don't paste large blobs (>~2–3KB). Avoid dumping entire generated files.
- One screen/component per task.
- Read 2–3 similar implementations before creating new code.
```

## 7. CONVENTIONS.md (Component Patterns) — Create This Once

Create `web/src/components/CONVENTIONS.md` with concrete, copy-pasteable patterns.

```markdown
# Component Conventions

## Pattern A: Button-like
```jsx
import { cx } from './types'
import { Icon } from './Icon'

/**
 * `variant`: 'default' | 'primary' | 'alert' | 'ghost'
 * `icon`: any <Icon> name
 */
export function Btn({ variant, icon, className, children, type = 'button', ...rest }) {
  const cls = cx('btn', variant === 'ghost' && 'tx', className)
  const attrs =
    variant === 'primary' ? { 'data-primary': true }
    : variant === 'alert' ? { 'data-status': 'emergency' }
    : {}
  return (
    <button type={type} className={cls} {...attrs} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}
```

## Pattern B: Surface-like (Card)
```jsx
import { cx } from './types'

/** `dark`: terminal-style panel (`.card.dk`); `as`: root tag, default 'div'. */
export function Card({ dark, as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag className={cx('card', dark && 'dk', className)} {...rest}>
      {children}
    </Tag>
  )
}
```

## Pattern C: Inline/status-like
```jsx
import { cx } from './types'

export function Chip({ className, children, ...rest }) {
  return (
    <span className={cx('chip', className)} {...rest}>
      {children}
    </span>
  )
}
```

## Rules
- `...rest` is **always last** (caller override wins)
- Forward arbitrary `data-*`/HTML props through `{...rest}`
- Use `cx()` to merge classes
- Document non-obvious props in JSDoc (values, allowed tags, shape of objects)
- Keep base class names exactly as in `dugo.css`
- Don't filter props; forward everything unknown via rest
- Respect id-suffix conventions for overlays/KPI
- Filename = PascalCase, matches export(s)
```

## 8. Most Effective & Cost-Efficient Recommendation

**Do these 3 things first — highest ROI, lowest cost.**

1. **Create `AGENTS.md`** (repo root) — global "mimic first" rule. Applies to every opencode run.
2. **Create `web/src/components/CONVENTIONS.md`** — concrete copy-paste patterns. Stops guesswork.
3. **Update your prompt to enforce "read 2–3 similar components"** — bake into `PROMPTING_GUIDE.md` (already done above). Use this for every new component task.

**Why this is cost-efficient:**
- Prevents drift → fewer iterations, less tokens
- Eliminates context bloat (read files, don't paste)
- Keeps visual parity to mockups without editing global CSS
- Scales to new screens/components without re-explaining
- Makes opencode default to the existing system

**Quick start:** Create the 3 files (`AGENTS.md`, `web/src/components/CONVENTIONS.md`, and keep this `PROMPTING_GUIDE.md`). Use the "new component" rule in every task. Run `vite build` on every change. That's it.
