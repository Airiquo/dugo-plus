# Hospital experience

Owner-directed redesign of the hospital workspace, following the donor and
administrator care direction (D67). Work is on `feat/hospital-experience`, based
on integration `98ff79e`.

## Design and interaction

- Overview combines independently loaded active requests and complete selected-period
  collections. Priority links, collection bars and workflow shortcuts lead to the
  next action. Collection totals are explicitly distinct from current stock.
  Failed sources are unavailable, never presented as zero.
- Desktop navigation follows Overview → Requests → Inventory → History, then
  facility/map/personal details. New request is a dedicated action. The mobile
  dock exposes Overview, Requests, Inventory and More; all other destinations
  remain available from More.
- The request composer has native radio choices for blood group and urgency,
  component/quantity inputs and a live pre-post summary. Invalid submission
  focuses the first invalid choice. Posting failure retains entries. Facility
  address remains read-only.
- Inventory shows eight stock cards for the selected component with exact counts,
  labeled in-stock/zero-stock states, Issue, Adjust and movement history. No
  unapproved low-stock thresholds, forecasts or clinical recommendations are added.
  Legacy unclassified units remain excluded from usable stock and explicitly labeled.
- `?view=screening` opens the screening/donation tab directly from workflow links.
  Match and complete donation-history reads start when this view opens, avoiding
  those reads on a stock-only visit. Awaiting donor acceptance is distinguished
  from awaiting screening. Selection
  requires Accepted, completed guidelines and Cleared, matching the existing
  server contract. New screenings require a deliberate result selection.
  Confirmation opens a review of donor/component/units before the existing
  sequential Worker operations. Partial failures remain reported per donation.
- Stock, screening, movement-history and collection-review dialogs use the
  existing native-dialog primitive: focus containment, Escape dismissal, return
  to the trigger and dismissal disabled during mutations. `AdminDialog` gains
  an optional eyebrow; its administrator default is preserved.
- History keeps donation and movement views, filtering, ordering, Load more,
  pagination and complete filtered/all exports. Movement component controls appear
  in the movement view. Loaded donation summaries remain labeled as loaded and
  show unavailable while loading/failed.
- Facility details use a focused name/contact editor with validation, save/discard,
  retained failed edits, and a separate administrator-managed address panel.
  Saved values are reconciled locally after the successful write, avoiding a
  delayed follow-up read replacing newer edits.
- Personal profile is dedicated to staff identity, photo and account facts;
  facility details and map have clear separate destinations. Personal details
  remain read-only except the existing photo flow.
- The map shows the actual saved pin, address, contact and coordinates with
  administrator ownership stated. Missing location and tile failures remain visible.

The app-owned CSS is scoped to the hospital workspace. Warm neutral surfaces,
brand-red primary actions, red urgent indicators, amber attention/zero-stock and
green ready/completed states use the existing theme tokens with text labels.
Both themes share the composition; mobile controls retain 44-pixel targets and
16-pixel form text. Shared base styles, data schema, rules and Worker are unchanged.
The reused administrator inventory/history screens retain their table/picker
behavior while receiving the clearer screening states and native dialogs.

## Exports and existing boundaries

CSV and Print / PDF remain on collections, requests, inventory, screening queue,
stock movement history and donation history. Filtered and All table data retain
D65's authorization and complete-pagination contracts. Switching the stock view
changes only the filtered component; All table data still includes every
component at the same facility. Movement-dialog exports keep the current
component/group context. No new personal data fields are exported.

Administrator-only location editing, removed partnership plans, existing route
slugs, saved theme selection, help contact and existing service authorization
remain in place. This task requires a frontend release after review. It adds no
Worker deployment or Firestore rules/index requirement to the earlier D63 rollout.

## Verification

- Vite production build passes; compiled bundles contain the redesigned screens,
  hospital-scoped styles, native dialog review and existing export controls.
- All 123 existing account/audit/matching/inventory/export regression tests pass.
- `node tools/check-docs.mjs` and whitespace checks pass.
- Local sample preview uses isolated Firebase Auth/Firestore emulators and the
  existing Worker harness; it contains fictional data and no production access.
  The app is served at `http://127.0.0.1:5195/hospital/dashboard`.
- **Current blocker:** local browser access became disabled in Work settings
  during implementation. Desktop/phone visual review, both-theme inspection,
  native-dialog interaction, save/reload and export UI verification of this
  redesign are pending browser access. Previous D63/D65 browser checks verify
  the baseline only and do not verify this redesign. The request to enable
  browser access is pending; no answer or visual result is assumed.
- Root `styles/`, `light/` and `dark/` mockups were not edited. Reference-image
  rendering with `tools/screenshots.py` is pending browser access; no stale
  mockup images are presented as this app's preview.
- Production and physical-device verification remain outside the local build.
  No production deploy was performed.
