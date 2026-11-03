# Record filters, donation analytics and report preview

Owner-requested continuation of the hospital redesign, on
`feat/hospital-experience` (D68–D70). Existing authorization scopes and route
slugs remain. No Firestore rule/index or Worker change is introduced.

## Hospital overview and charts — D68

The overview has a donation activity calendar with one square per Philippine-time
day, colored by confirmed donation count. Count and collected units are separate
measures. Selecting a day filters collection records and their filtered exports;
zero-donation days remain selectable and future days are disabled. Year/month
selectors, recent-period shortcuts and inclusive From/Through dates support
single-day, month, year and arbitrary ranges. Invalid/inverted dates do not apply.
A visible date-picker alternative and arrow-key movement make the dense calendar
usable without requiring precise pointer clicks. Month labels align to their
calendar weeks; calendars scroll within their panel.

The overview also has a zero-based units-over-time chart. Its intervals adapt to
daily/weekly/monthly/yearly scales with zero intervals retained. Exact interval
values are available as labeled buttons that apply the dates. Blood-group bars
filter collection records. Current stock is never presented as collected units.
The calendar loads the complete selected year plus the selected date range;
All time explicitly loads complete facility history. Display pagination does
not truncate charts, summaries or filtered reports. Query failures leave sources
unavailable and expose retry instead of showing partial totals as complete.

Inventory adds comparative group bars for the selected component. Stock cards,
bars and a clickable legend use explicit **0 units**, **1–4 units**, **5+ units**
display bands. These are numeric presentation bands, not a configured replenishment
policy, expiry/compatibility check or clinical sufficiency decision. Text labels
and exact counts accompany color in both themes. Preserved legacy stock remains
unclassified and excluded from usable component stock.

Hospital KPI shortcuts filter the corresponding records: active/time-sensitive
request links carry status/priority; collection KPIs show selected-period records;
stock KPIs select all/stocked/zero/1–4 groups; history KPIs select donation records,
positive/negative movements or adjustments. Chart and KPI filters retain the
facility authorization context.

## Applied record filters — D69

`RecordFilters` is a shared form with visible labels, Apply, Reset, active-filter
count, unapplied-edit feedback, inclusive PHT dates, validation, disabled state
and an empty-result recovery path. Existing contextual search/sort controls are
retained where appropriate. Options for known enums come from stable catalogs,
not the currently populated record set. A donor with zero requests can still
choose every supported request component. Historical donation-type choices
combine the stable reference vocabulary with any additional types present in
history. Selecting a type does not alter compatibility, eligibility or consent.

| View | Available filters |
| --- | --- |
| Hospital collections | Calendar/day/month/year/custom dates, search, group, component; group/interval chart shortcuts |
| Hospital requests | Active/all/per-status, priority (including urgent + stat), group, component, search, requested dates, sort |
| Hospital stock | Component, exact group, all/stocked/numeric quantity bands; KPI/chart/legend shortcuts |
| Hospital screening | Group, component, donor response, screening result, matched dates, donor/request search, date order |
| Hospital movement dialog | Movement type, recorded dates, search; fixed component/group remains scoped |
| Hospital/admin confirmed history | Complete history, group, component, dates, donor/request/reference search, column/field ordering |
| Hospital/admin movement history | Complete history, group, component including legacy, movement, added/removed direction, dates, reason/actor/reference search, ordering |
| Donor requests | Current available/past tab, stable component menu, distance, priority, request status, response and requested dates; existing search/sort |
| Donor activity | Stable donation type menu, hospital, dates; existing search/sort |
| Donor alerts | Read state, dates, hospital/message search; unread actions and sort retained |
| Donor privacy | Type, status, dates and request/response search |
| Admin accounts | Role, access, group, creation dates; existing identity/reference search/sort |
| Admin account history | Event, dates, actor/reason/event search; applying filters loads all protected account-history pages |
| Admin privacy queue | Open/per-status, type, dates; existing subject/details search/sort |
| Admin audit | Existing server-backed account/actor/event/date filters retained; date bounds made explicitly PHT; page-local text search/sort remains labeled as such |

Hospital histories fetch every authorized page before filtering and totals, with
progress and whole-source failure states. This costs more reads than the former
initial 50-record screen, but prevents filters falsely reporting no result for
older records. Filter edits apply to the loaded dataset rather than refetching
per keystroke; there is no added polling. Stock movement reads retain four-group
concurrency. Admin account history keeps the existing paged default and fetches
complete protected history when filters are applied. Server redaction remains.

Pending donation selection is restricted to the ready records in the filtered
queue; changing filters clears selection. Complete filtered exports use the
same predicate as the table, before pagination. All data removes table filters
without widening donor, facility or fixed movement/account context. Admin
account creation dates are now included by the existing account-directory read;
no new field is written. Hospital donation reads add an optional exclusive
`until` bound, preserving old `since`-only callers and existing indexes.

## Print/PDF overlay and export layout — D70

All shared Print / PDF actions open an in-app native-dialog preview with
**Back to table**, Close and **Print / Save PDF**. The original table/filter/page
state stays mounted. Escape and the Back button close the preview and restore
focus. Preparing a report can be cancelled; completion after cancellation cannot
open a report or download a partial file. Native-dialog scroll locks account for
nested account/movement/report dialogs, including out-of-order cleanup.

The preview uses an escaped standalone report in a sandboxed iframe without
scripts, external assets or navigation. Browser print opens only when explicitly
requested from the preview, with Save as PDF provided by the browser. Repeated
headers, PHT record dates, counts, escaping and formula-safe CSV remain. The
preview button stays disabled until its document loads. Failed preparation has
an error plus Back; empty datasets generate a labeled empty report.

Export controls use a bounded grid and panel-width container query, so narrow
cards/dialogs switch the scope selector above the two buttons even on desktop.
Selects/buttons can shrink and wrap; full-bleed request/admin panels reserve
explicit gutters. No horizontal clipping is used to conceal an oversized control.

## Donor map and Requests icon

Donor maps now expose labeled 44-pixel Zoom in and Zoom out buttons, alongside
location and expand/collapse. Zoom state follows Leaflet events, disables the
appropriate limit button and respects reduced motion. Both compact/expanded
views use the same controls. Navigation across donor/hospital/admin blood
requests uses the shared clipboard/medical-cross icon; blood quantity remains
represented by a droplet.

## Verification and limits

- Production Vite build, compiled JS/CSS checks and traceability/whitespace checks.
- 133 unit/regression tests, including ten new boundary/aggregation/filter/export/
  nested-scroll-lock cases: PHT midnight/final millisecond, leap year, zero days,
  complete 137-row filtering, weekly/monthly/yearly partial intervals, numeric
  stock bands, matching CSV/report row sets and out-of-order nested cleanup.
- Semantic React rendering in an isolated harness verifies stable choices on an
  empty list, 366 leap-year calendar buttons, exact stock bands, accessible day
  alternative and sandboxed preview/Back controls. This is not visual QA.
- Real Firebase SDK + Auth/Firestore emulator checks verify optional upper-bound
  reads, inclusive PHT dates, cursor pagination, old `since` callers, complete
  bounded exports, cross-facility denial, facility/profile save/read and admin
  creation-date reads with fictional data.
- Preview is running at `http://127.0.0.1:5195/hospital/dashboard`. Disposable
  accounts are `qa-staff@example.test`, `qa-donor@example.test`,
  `qa-admin@example.test`; password `Fixture-password-2026!`. These work only in
  the isolated local emulator project, never production.
- **Browser verification remains blocked.** Owner enabled local browser access,
  but the browser tool continued to report disabled and was then removed from
  this session. Current desktop/phone/theme visual checks, form clicks, donor
  map button interaction, iframe browser printing and the four manual auth
  smoke cases remain unverified. The prior D63/D65 browser results verify the
  baseline only. The PR must not claim this work visually verified. The owner explicitly
  requested merging into integration on 2026-11-03 with these checks outstanding;
  merge authorization does not establish visual or production verification.
- No production deploy, real-data mutation or physical-device check occurred.
  Existing build chunk-size warning remains; no new runtime chart dependency.
