# Record sorting across roles (D55)

| Surface | Controls and scope |
|---|---|
| Admin Accounts | Account name, type/facility and access status; sort all filtered loaded accounts before the 10-row page is selected. |
| Admin Data Requests | Submitted date, subject, request type and status across the loaded queue. |
| Admin Audit Trail | Existing technical data columns sort in either direction; the subsequent audit redesign will preserve sorting with explicit pagination scope. |
| Hospital Requests | Blood/component, numeric units, priority label, status and requested date; sort all loaded filtered facility requests before pagination. Default urgency-first ordering is restored with Reset order. |
| Donor Requests | Hospital, numeric distance, requested date, units and donation type. Default urgency-then-distance order is preserved until changed. |
| Donor Activity | Donation date, hospital, donation type and units. Date ordering retains year grouping; other keys use a single All donations group so year boundaries do not override the selected order. Default newest-first history and eligibility calculations remain independent of presentation ordering. |
| Donor Alerts | Received date, hospital and read status; default delivery order remains. |
| Mobile | Accounts and shared tables expose Sort by/direction controls when headers are hidden. Donor card controls wrap on narrow layouts. |
| Access | Data scope, role authorization and mutation behavior are unchanged. Action columns remain unsortable. |

## Shared behavior

| Contract | Implementation |
|---|---|
| Header interaction | Keyboard-operable buttons, visible direction arrows and aria-sort on the selected column; activation toggles ascending/descending. |
| Ordering | Numeric values compare numerically; text uses case-insensitive natural ordering; timestamps convert to epoch values; missing values stay last in both directions. Ties are stable and input arrays are not mutated. |
| Pagination | Sorting occurs before slicing a table page. Sorting resets Accounts/Hospital to page 1. |
| Default order | Null sort key preserves the screen's existing order. Mobile/list selectors include an explicit default-order option. |
| Future tables | Table accepts controlled sort/onSort; parent owns full-data ordering/pagination. Set sortable:false on action columns. |

## Verification

| Check | Result |
|---|---|
| Regression suite | 102 pass (98 existing plus four shared ordering tests). Includes numeric/text/date/missing/tie/source-preservation and pre-pagination ordering. |
| Build/docs | Frontend build passes; existing large-chunk advisory. Documentation validator and diff whitespace checks pass. |
| Accounts fixture | Name ascending starts Alex Rivera; descending starts Volunteer 7. Mobile sorting remains reachable and produces the same descending order. |
| Hospital fixture | Units ascend 1–10 on page 1 and 11/12/20 on page 2; descending resets to page 1 and begins 20/12/11/10. |
| Donor Activity fixture | Units ascend 2/7/10 and descend 10/7/2, crossing the original year groups correctly. |
| Donor Requests fixture | Hospital names ascend Alpha/Middle/Zeta and descend Zeta/Middle/Alpha. |
| Donor Alerts fixture | Received dates ascend Oct 1/Oct 10 and reverse correctly. |
| Privacy queue fixture | Submitted dates reverse correctly between ascending/descending. |
| Responsive/theme | Isolated fixtures use real role screens/components/styles. 390px Accounts/Alerts have no page-wide overflow. Shared controls use theme tokens. No production accounts or data writes. |
| Limits | Incomplete backend feeds remain incomplete; ordering does not claim to retrieve records absent from the loaded role-scoped dataset. No new backend, schema or index dependency. |

All application changes belong to feat/sortable-role-tables and are reviewed through a PR into integration. Screenshots are local fixture artifacts in /private/tmp/dugo-role-sort-proof.
