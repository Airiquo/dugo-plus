# Workspace controls and navigation — 2026-11-04

The owner's screenshot and follow-up instructions define this change (D74).
Requirement statuses and phase counts remain unchanged; this is a presentation
and client filtering/export update across existing workflows.

## Donor screens

Requests starts with a compact heading and tab counts, followed by one search,
distance/component/urgency bar and one combined sort dropdown. Request status,
response and inclusive Philippine-time dates live in a native More filters
drawer. Valid changes apply immediately, Clear appears only with active filters,
and invalid date edits preserve the last valid results. The drawer traps focus,
closes with Escape/backdrop/close, and returns focus to its trigger.

The list and map share the filtered dataset. Missing distances remain labeled;
missing donor location has a profile link instead of an asserted distance.
Empty states offer a specific next step: clear incompatible filters, widen the
local view to 50 km, check again, or visit the existing Alerts inbox. Widening
filters only requests already matched to this donor; it does not expand the
server matcher or hospital radius. Most urgent display order is Immediate need,
Urgent, Routine; server matching priority is unchanged.

Activity uses one instant search/type bar with hospital/date choices in More
filters, a combined sort dropdown, and CSV/Print-PDF actions beside the result
summary. Visit details and readiness remain; on phones history precedes the
readiness panel. Alerts has Newest/Oldest/Unread first in one dropdown and the
existing mark-read/request actions. Its search/filter panels, tab filter and
export actions are removed, as requested.

## Staff filters and exports

The shared filter component renders a compact row with only the fields supplied
by that screen. Date ranges are an optional disclosure with paired From/To
fields and local helper/validation text. There is no universal filter card,
Apply/Reset pair, unused-filter summary or repeated global date note.

Accounts keeps name/email search, role and access status; the additional blood
and creation-date panel and duplicate status-filter tiles are removed. Privacy requests keeps search, queue status
and request type. Hospital blood requests combines its existing queue controls
with blood group/priority/date filters and exports in the table toolbar.
Collection, screening and movement views retain their relevant fields. Audit
history's server-scoped account/actor/event/date search is a disclosure with an
explicit Search history action; local search and authorized cursor traversal are
preserved. Account activity fetches its complete history once when needed for
filtering, then filters the loaded records without re-fetching on every edit.

All remaining CSV/PDF exports use the current table's filters and sort across
all matching pages, exactly as the owner confirmed. The export-scope dropdown is
removed. Existing authorization, complete-page traversal, error handling, CSV
escaping and print preview remain. Table dropdowns receive the complete selected
sort direction; screens with their own sort dropdown hide the duplicate one.

## Identity and scrolling

The hospital sidebar no longer contains + New request. Existing request-page
creation actions remain. The history link reads History, with an accessible
Donation and stock history label. Facility names use an account/facility-keyed,
in-memory resolved name between route loads; the first load shows a stable
placeholder. No new data read, local-storage identity or authority is added.
Account name/role/image share one component across donor, hospital and admin;
the profile name takes priority over an older Auth display name.

The root uses clipping that permits document-sticky positioning. Staff sidebars
stay within the viewport; their navigation scrolls internally on short screens.
Empty overlay grid rows add no trailing gap. The shared signed-in footer is the
last flow element; mobile navigation clearance belongs to the footer rather
than an extra area after it. Document overscroll is disabled for signed-in
workspaces, while normal scrolling and native dialog scroll locks remain.

## Verification

Local build and the existing 133 regression checks pass. Browser verification
uses the actual screens and shared components in a separate temporary Vite
fixture harness; it adds no production users or records. The harness is outside
the repository and is excluded from the production build.

Verified:

- Requests: mobile first-screen results, immediate filters, date-range error
  recovery, Escape/focus restoration, clearing, wider distance and combined sort.
- Activity: filtered CSV contains all six matching visits in oldest-first order;
  PDF preview contains the same six records/order. Readiness follows history on
  phones, and both export buttons remain in one compact row.
- Accounts: PDF preview exports 15 records across a ten-row page boundary in
  selected descending order; search narrows the export to eight matching rows
  in the same order.
- Alerts: one sort control, no filters or exports; Unread first preserves all
  messages and places unread messages first.
- Admin/Hospital sidebar stays approximately 16 px from the viewport top after
  document scrolling; both measured footer gaps are within one pixel of rounding.
- Hospital sidebar has no creation link and uses the shortened History label.

Responsive checks cover Requests, Activity, Alerts, Accounts and the hospital
request queue at 360/768/1440 px in both themes. They show no horizontal overflow
or clipped controls; the first donor result is visible within the first screen.
After compacting the staff phone controls, the first Accounts and hospital queue
record also starts within the 900 px phone test viewport. Empty, loading and
error layouts have no trailing area after the footer beyond subpixel rounding.
Combined table dropdowns were exercised in both date directions; live search
updates the displayed records without Apply. A deliberately delayed facility
response confirms that the resolved hospital name remains visible on the next
route before its new response arrives. At a 650 px desktop height, hospital
navigation can scroll internally while the sidebar remains viewport-bounded.

The Vite build, traceability validation and 133 existing regression tests pass.
The production bundle contains the new controls, account identity and scrolling
rules. The feature targets protected integration. The release procedure is
Hosting only: build the merged integration revision and verify both Firebase
Hosting entry points. No Worker, Firestore rules,
indexes, provider configuration or production records change in this feature.
Broader real-device and clinical workflow verification remains open.

Local fixture evidence is under `personal/workspace-controls/` in the primary
checkout (gitignored). The preview uses clearly marked sample data; no fixture
route, login bypass or sample dataset is included in the application build.
