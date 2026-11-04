# Control caret spacing and administrator radius visibility

Owner-directed implementation on `feat/mobile-carets-admin-radius`, based on
local and origin `integration` at `610b561` (D81). The worktree is
`/Users/pol/.codex/worktrees/6bbf/dugo_mobile_web`.

## Behavior

- `/admin/settings` has notification retry fields, save/discard, retry-default
  loading, saved metadata and existing read/save recovery. The radius editor,
  tier addition/removal and ladder preview are removed. Retry defaults retain
  the loaded radius tiers rather than restoring the default ladder.
- `/admin/dashboard` shows the notification retry policy and an explicit
  “Review notification settings” link; radius/tier metrics are removed.
- `App.jsx` and `layout/AppShell.jsx` were audited: there is no standalone radius
  route/nav item. `/admin/settings` keeps its existing role/verification gates.
  No routing, matcher, Firestore service, rules, index or stored data changes.
- All app single selects share one CSS caret with a 16px end inset and 40px
  end text clearance. Logical padding and RTL caret positioning apply to raw
  selects as well as the shared `Select` primitive. Existing donor wrapper
  pseudo-carets are suppressed. Multiple/list-box selects are excluded;
  forced colors restore the native select appearance. Keyboard focus uses the
  shared blue token. Backgrounds, disabled behavior and native popup remain.
- Filter/date/audit/profile disclosure controls have end spacing and nonshrinking
  trailing carets. Native detail markers and decorative/link arrows are retained.
- The public landing/news header no longer renders `PubThemeToggle`. Its mobile
  menu and all other theme controls remain available in their existing places.

## Coverage and evidence

Source audit covered `Select` in `components/Field.jsx`, `SortControls`,
`RecordFilters`, `DonorFilterBar`, `HospitalRequestResponses`, `TableExport`, and
raw selects in donor Alerts/Profile/Privacy, public Partner, admin
AuditTrail/DataRequests, and hospital Dashboard/Requests/Inventory. TableExport
currently has labeled CSV and Print/PDF buttons, with no dropdown caret.
Disclosure audit covered Activity visit cards, profile photo settings, saved
record/technical details, hospital extra filters and audit search.

An isolated fixture imports this worktree's real components and styles, with
in-memory configuration/auth/data adapters only. No production reads or writes
were performed. Browser artifacts and its reproducible fixture/check script are
in `/private/tmp/dugo-carets-radius-qa/` (not committed runtime dependencies).

- Headless Chrome: 24 layout checks (controls, Settings and Dashboard at
  320/360/390/1440px, light and dark), no horizontal page overflow or JS errors.
  Screenshots at all combinations; 320px light controls and 390px dark Settings
  were visually inspected.
- Shared/raw/wrapped/sort/filter/hospital/admin/response selects render one inset
  caret and text clearance; list boxes retain their native multi-option layout.
  Typeahead selects Plasma with the keyboard; visible focus, disabled controls,
  keyboard disclosure activation, explicit/inherited RTL and forced-color appearance
  pass, including with the compiled production stylesheet.
- Settings fixture starts with custom 7/31km tiers. Saving edited retries and
  loading/saving retry defaults retain both custom tiers and waits. Discard,
  validation focus, saved success, loading, read-error lock and save-error draft
  retention pass. Dashboard has no radius/tier content.
- Landing toggle absence checked at 320/390/1440px; mobile menu opens by its
  labeled button and closes with Escape at phone widths.
- `cd web && npx vite build`, `node tools/check-docs.mjs` and `git diff --check`
  pass. Compiled CSS contains the single-select, RTL and forced-color rules;
  compiled JS contains retry-default retention copy and notification policy,
  without radius editor/preview labels or a landing-header toggle element.

`python3 tools/screenshots.py` was attempted but cannot run because Pillow
(`PIL`) is not installed. Shared reference/mockup styles were not changed;
the independent browser screenshots above cover the app changes.

No new implementation-mirroring CSS test was added. Security/transaction suites
are not applicable to these UI-only changes. No service/lib/rules files changed,
so the four authenticated service smoke checks were not triggered. Live signed-in
verification, physical Android/iOS native popup behavior and other browser engines
remain unverified. Requirement statuses and phase counts remain unchanged.

## Handoff

This is a local frontend feature only. No push, merge, deployment, migration or
backend rollout was performed. Shared-file edits were serialized with the provided
atomic directory lock. The earlier `feat/request-radius-maps` removal was reviewed
as reference, but its fixed-distance policy/backend changes were not ported.
