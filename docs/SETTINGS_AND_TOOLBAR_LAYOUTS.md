# Settings and record-control layouts

Owner-directed UI work on `feat/settings-export-layout`, branched from updated
`integration` at `a7fa998`. Worktree:
`/Users/pol/.codex/worktrees/6bbf/dugo_mobile_web`. Decision: D83.

## Owner answers implemented

- Donor, hospital and administrator Settings contain Profile and Appearance
  tabs. Existing profile forms/locks/photo flows are composed in the Profile
  tab and retain unsaved edits when switching tabs. Appearance uses the existing
  light/dark preference and local storage.
- `/donor/settings`, `/hospital/settings` and `/admin/settings` retain existing
  session, verification, active-account and role guards. `/home`,
  `/donor/profile`, `/hospital/profile` and `/admin/profile` are compatibility
  redirects to the appropriate Settings page. Existing sign-in home selection
  continues to work through these aliases.
- Profile heads open Settings and Sign out. Menus open beside desktop staff
  sidebars and below donor/compact staff headers; native popover top-layer
  behavior avoids sidebar clipping and provides Escape/outside dismissal.
  Standalone sidebar/header theme and sign-out controls are removed.
- The owner subsequently removes administrator notification retry editing and
  its Overview card/entry point. Settings has only the two requested tabs.
  Dashboard no longer reads the now-undisplayed configuration. Stored matching
  tiers/retry settings, services, validation and backend readers are unchanged.
- Every shared record export uses one Export dropdown with Print CSV and Print
  PDF options. CSV still downloads a CSV; PDF still opens the existing report
  preview before printing. The final print action inside that preview remains.
  Existing data callbacks, filter/order/pagination traversal and facility/donor/
  consent limits are preserved. The directory's existing matching/all-pages
  scope choice moves into its Export overlay; no new screenshot-only scope is
  invented.
- Date ranges use anchored overlays without expanding the page. The button
  keeps a stable label/width when dates change. RecordFilters affects privacy,
  account history and hospital record views; Audit Trail and hospital Overview
  custom dates also use overlays. Donor advanced dates already live in a dialog.
  Date-of-birth and calendar single-day inputs are not range controls.
- The owner clarifies that privacy retains the existing form/history composition.
  Its form behavior and responsive columns stay. History has a compact unboxed
  toolbar, separate request cards, status/details/dates/response grouping and a
  right-aligned, contextual View button. The native detail dialog presents the
  recorded outcome, dates, request ID, original details, reply, rejection reason
  and action. No claim about data sharing is inferred from status.

## Components and placement audit

`AccountSettings`, `AccountMenu` and `ControlPopover` provide shared interactions.
`RecordFilters`, `DonorFilterBar` and `TableExport` retain their existing callback
contracts. Popovers forward root props and use native top-layer dismissal;
Settings tabs support arrow/Home/End navigation.

Export placement audited/updated at all 13 declarations: admin Accounts and
account history, Data Requests, Audit Trail; donor Activity and Privacy; hospital
Requests, Overview collections, Inventory stock/pending queue/movement dialog,
History, and Donors (directory and selected-donor history share a declaration).
Search fields flex to leave room for Export; narrow layouts wrap controls.

## Verification

An isolated fixture imports this worktree's real App, routes, guards, components
and CSS, with synthetic in-memory service/auth adapters. It performs no production
reads or writes. Scripts/screenshots/results are in
`/private/tmp/dugo-settings-layout-qa/`.

- 128 Chrome layouts: 16 routes × 320/390/768/1440px × light/dark. No horizontal
  page overflow or JavaScript errors. Stable mobile Profile/Appearance and desktop
  toolbar/privacy screenshots were inspected.
- All three Settings tab sets, keyboard tab navigation, radio choices and theme
  persistence across reload; old profile/home redirects.
- Settings/Sign out menu items, side placement for desktop sidebars, Escape,
  320px menu bounds, successful sign-out and retained error/retry on failure.
  Settings retains unsaved profile edits when changing tabs.
- Date-overlay geometry in Privacy, facility donor history and hospital Overview;
  320px bounds, immediate valid date filtering and Escape dismissal.
- Privacy detail content, rejection reason and focus restoration to the View
  trigger. Submission/processing services and stored outcomes are untouched.
- Seven CSV/PDF flows: donor Privacy/Activity, admin queue/Accounts, hospital
  Donors/Requests/History. CSV contents include all three fixture privacy records
  and the directory export's second-page fixture; report preview/Back works.
  Other export placements use the same component and unchanged data callbacks.
- Missing-configuration view checked through the real App fixture. Live Firebase
  sign-in/save/verification smoke and physical Android/iOS/browser-engine checks
  remain unrun; wrong-role, suspended-account and unverified-account route gates
  were checked with fixture identities. No service/lib/rules files change.
- Existing export, request-review, sorting and directory unit checks pass (13
  tests). Build, traceability, whitespace and compiled-output checks are run before
  the implementation commit. No implementation-mirroring CSS test is added.
- `python3 tools/screenshots.py` remains unavailable because Pillow is not
  installed. Shared mockup styles are unchanged; independent app screenshots
  above provide responsive/theme coverage.

No schema/index/Worker change, deployment, push or merge is part of this task.
Requirement statuses and phase counts are unchanged. Shared-file edits used the
provided atomic writer lock. A safety stash of the pre-integration UI work was
retained while moving onto the newer feature baseline.
