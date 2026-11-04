# Owner-supplied redesign pack

Archive extracted to `/private/tmp/dugo-redesign-instructions-nov04`.
The root and nested `CODEX_PROMPT.md` are identical. All duplicate images have
identical decoded pixels. D84 records implementation on top of `807b72e`.
No screenshot emoji is used; existing SVG icons and real fonts/tokens remain.

## Screen 01 — Find where you can help

Distance, donation type, combined sort and Filters share the main toolbar.
Priority, request status, donor response and dates remain in the existing filter
dialog and apply immediately. Clear filters retains its existing reset behavior.
Distance labels read Within N km. The map stays alongside the list, while the
empty state retains the working 50km action and Alerts inbox destination.

`TODO(design)`: the app has no alert opt-in setting; the existing View alerts link
is retained instead of presenting an action that claims to enable notifications.
No matcher, acceptance, consent, routes or data-layer changes.

Screen 01: build/docs/whitespace checks pass. Browser fixtures checked at
1440/390/320 in light/dark with no page overflow or errors; 1440 screenshot
compared with reference 01. Artifacts: `/private/tmp/dugo-settings-layout-qa/pack-01-*`.

## Screen 02 — Donation history

The toolbar and history span the content width, with the existing readiness and
summary panels retained below rather than reducing search/export space. The empty
state groups an SVG blood-drop tile, heading, explanation and matched-request
action. Existing record details, sort/filter/export callbacks and eligibility
logic remain. Browser layout checks cover 1440/390/320 light/dark and the empty
state; compiled output/build/docs/whitespace checks pass.

## Screen 03 — Privacy history within the existing page

Per the owner answer, the submission form and history retain their two-column
composition. History uses one unboxed search/filter toolbar, count, request text,
status, sent/answered dates and reply preview, with a separate View action to the
right. Date range is an overlay and exports use the shared menu. No request data
or submission behavior changes. Screen 03 is covered by the existing D83 layout
and the D84 shared controls rather than a duplicate screen implementation.

## Screen 04 — Request detail drawer

The existing right-side native drawer retains outcome, dates, original details,
reply, rejection reason and action. Request ID has a full-value Copy action with
visible failure feedback and truncation; missing actions read Not recorded. No
claim that no data was shared is inferred. The page-level privacy composition
remains unchanged per the owner answer.

## Resolved owner answers and shared exports

Keep the form/history privacy composition and tidy only history. Add This page
only while retaining all existing export scopes. Use Download CSV and Print PDF
inside Export, never as separate toolbar buttons. Shared exports now receive an
explicit displayed-page callback at all 13 report declarations. Page scope uses
only rendered records, without cursor traversal; complete scopes retain existing
callbacks and authorization. The directory also retains All pages / Clear filters.
Both formats use the same chosen scope, and the native radio group supports
arrow-key selection. No unresolved product question remains for these choices.

## Screen 05 — Admin account directory

One toolbar groups search, account type, access status, blood group, joined-date
overlay and Export. New presentation filters operate on the already-loaded
authorized account collection; joined dates use the existing PHT-inclusive filter
helper. Existing columns, sorting, account actions, provisioning and account-history
controls remain. Meta text states showing/loaded counts and date timezone.

## Screen 06 — Admin request queue

Open/closed filters use underlined counted buttons; specific outcome filters
select their corresponding group. Singular result/request labels are corrected.
Every row has View with its contextual accessible label; the existing review
workflow, sortable columns, outcome filters, pagination and footnote remain.
Build/docs/whitespace and 1440/390/320 light/dark checks pass.

## Screen 07 — Facility donor directory

The completed-only/consent banner stays. Directory title has a matching-count
pill; the subtitle states page-local search/filter/sort scope, while Export keeps
complete traversal or the selected current-page scope. Sort is explicitly labeled
Sort (this page); donor references use the shared full-ID Copy action. Pagination
uses singular/plural grammar. No authorized identity or read contract changes.

## Screen 08 — Facility donor history

The banner uses the already-authorized selected donor name as its title, with a
separate copyable donor ID and existing legacy-record note. Completed donation
references include labeled full-ID Copy actions for donation/request IDs. Existing
blood/component/date/search/sort, export scopes, facility/donor bounds and cursor
pagination remain. Missing identity is explicitly unavailable, never inferred.

## Screen 09 — Hospital response list

Response cards have one stage chip, consent-gated contact chips, a segmented
stage bar, response/match meta and separate View donor / response and Manage
donation actions. Completed rows instead open the existing donation detail view.
Both pagination controls and the completed-donation list remain. Collected units
are explicitly summed only for the displayed completion page: the existing API
returns bounded pages and no request-wide aggregate. No extra background reads,
API change or invented total is introduced (`TODO(design)` in the component).

## Screen 10 — Focused donation flow

Manage donation opens one attempt with the constant request/donor context, green
completed steps and one next actionable stage. Screened → Processing → Completed
uses the existing operations and accepted/consent/version constraints. Successful
stages stay in the flow with feedback. Defer donor opens a required reason form
above the main action; blank/oversized text cannot submit. Cancel returns to the
active flow. Completed requires valid positive safe integer units and displays the
returned actual units only after the existing completion operation succeeds.
Completed/Deferred/Rejected are final. Existing detail/pagination/refresh controls
remain. Unit tests cover sequence gating, private/unaccepted/final attempts, required
deferral text and invalid actual units.

`TODO(design)`: the response API omits screened/processing/completed timestamps.
Steps/logs show Date unavailable where the API provides no date; match dates are
never reused and browser times are never invented as recorded stage timestamps.
The response API and data model remain unchanged. The completion list is inside
the overlay's scrollable content so it stays reachable after the response list.

Screen 10: the five reference states were compared at desktop width using the
existing fonts/tokens. Isolated browser checks pass next-stage gating, valid units,
completed feedback/list return, required deferral/cancel from every active stage,
save-failure retention and empty/error states. Phone checks pass at 390/320 in both
themes. Opening/returning the flow moves focus to its active context.
Artifacts: `/private/tmp/dugo-settings-layout-qa/pack-10-*`.

## Universal export follow-up — D85

The owner subsequently chooses all three scope options on every menu, with
Download CSV and Print PDF. All 13 export declarations use the same shared
menu. Two displayed-page callbacks were corrected to attach to TableExport
itself (account activity and facility collections). Donor donation history now
clears its presentation filters for the all-pages report while retaining sort.
All-scopes callbacks continue using existing authorized services. Selecting a
report scope does not clear the visible page's filters or change its subject.

## Final local verification

- Vite production build passes (254 modules); generated JS/CSS contains the
  universal labels and donation-flow selectors. Existing chunk-size warning remains.
- `node tools/check-docs.mjs` and `git diff --check` pass. Requirement statuses
  and phase counts are unchanged.
- 16 UI-helper/report tests and 13 existing inventory-operation tests pass.
- Isolated Chrome fixture run passes 128 route/width/theme layouts across
  1440/768/390/320, with no page overflow. Settings tabs/theme persistence, profile
  side menus, sign-out success/failure, legacy redirects, configured/unconfigured
  gates, privacy drawer focus and stable date-overlay geometry pass.
- Every one of the 13 report declarations has both complete and displayed-page
  callbacks. Browser checks confirm identical three-scope/two-format menus at all
  13, filtered/all/current-page CSV and PDF behavior, retained visible filters,
  complete directory cursor traversal and donor all-history exports. Seven
  representative menus also pass phone bounds/Escape/focus checks in both themes.
- Reference layouts 01–10 were reviewed at 1440 using real app fonts; screen 03
  retains the owner's form/history exception. Captures and fixture-only scripts:
  `/private/tmp/dugo-settings-layout-qa/pack-*`, `verify.mjs`, `flow-check.mjs`,
  `export-scope-check.mjs`, `universal-export-check.mjs`, `export-mobile-check.mjs`.
- No live data writes, service/schema changes, deployment or merge. Physical-device
  and real-account cross-browser checks remain separate rollout verification.
- The reference-image helper `python3 tools/screenshots.py` was attempted but
  cannot start because Pillow/PIL is absent. Browser layout PNGs above were generated.

## Controls and open design gaps

No original control could not be placed. The owner's explicit removals (landing
theme switch and admin retry screen/card) remain removed; all report formats are
menu actions. Existing request acceptance, consent, review and authorized export
operations remain in place. No unanswered owner clarification remains.

Existing capability gaps are recorded as TODO(design): alert opt-in has no setting
to enable from the empty state; response-stage timestamps are absent from the API;
completed-donation pages have no request-wide aggregate. The UI keeps the working
alerts link, shows unavailable dates explicitly and labels the collected-unit sum
as page-only. These gaps do not invent backend behavior.

## Changed files

The following files carry this UI task (relative to the repository root):

- `docs/PHASES.md`
- `docs/REDESIGN_PACK.md`
- `docs/REQUIREMENTS.md`
- `docs/SETTINGS_AND_TOOLBAR_LAYOUTS.md`
- `docs/TABLE_EXPORTS.md`
- `web/src/App.jsx`
- `web/src/components/AccountMenu.jsx`
- `web/src/components/AccountSettings.jsx`
- `web/src/components/ControlPopover.jsx`
- `web/src/components/CopyId.jsx`
- `web/src/components/DonationProgress.jsx`
- `web/src/components/DonationStageTrack.jsx`
- `web/src/components/DonorFilterBar.jsx`
- `web/src/components/HospitalRequestResponses.jsx`
- `web/src/components/RecordFilters.jsx`
- `web/src/components/RequestCompletedDonations.jsx`
- `web/src/components/SortControls.jsx`
- `web/src/components/TableExport.jsx`
- `web/src/components/index.js`
- `web/src/layout/AppShell.jsx`
- `web/src/layout/DonorNav.jsx`
- `web/src/layout/HospitalShell.jsx`
- `web/src/layout/RoleShell.jsx`
- `web/src/pages/admin/Accounts.jsx`
- `web/src/pages/admin/AuditTrail.jsx`
- `web/src/pages/admin/Dashboard.jsx`
- `web/src/pages/admin/DataRequests.jsx`
- `web/src/pages/admin/Profile.jsx`
- `web/src/pages/admin/Settings.jsx`
- `web/src/pages/donor/Activity.jsx`
- `web/src/pages/donor/Privacy.jsx`
- `web/src/pages/donor/Profile.jsx`
- `web/src/pages/donor/Requests.jsx`
- `web/src/pages/donor/Settings.jsx`
- `web/src/pages/hospital/Dashboard.jsx`
- `web/src/pages/hospital/Donors.jsx`
- `web/src/pages/hospital/Inventory.jsx`
- `web/src/pages/hospital/InventoryLog.jsx`
- `web/src/pages/hospital/Profile.jsx`
- `web/src/pages/hospital/Requests.jsx`
- `web/src/pages/hospital/Settings.jsx`
- `web/src/styles/app.css`
- `web/src/utils/donationProgress.js`
- `web/src/utils/donationProgress.test.js`
