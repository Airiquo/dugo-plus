# Cross-role table exports and public help — D65/D66

The shared `TableExport` control offers Filtered results / All table data,
Export CSV and Print / PDF. PDF opens an isolated print view and the browser's
print dialog; choose Save as PDF to save a file. It uses no remote PDF service.
A blocked popup gives a retryable message. Reports use explicit plain-value
columns, not copied DOM cells, so IDs are complete and buttons/inputs are absent.

Filtered means every matching record before display pagination. All removes
that table's filters; it never expands beyond the signed-in donor, selected
facility or selected account-history subject. Records represented as cards or
a timeline on phones receive the same controls as their table equivalents.

## Coverage

| Role / route | Record view | Filtered scope | All scope |
| --- | --- | --- | --- |
| Admin `/admin/accounts` | Account directory | Role, access and search; current sort over all matches | Entire authorized directory |
| Admin account-history dialog | Selected account activity | Complete activity for this account | Same fixed account context |
| Admin `/admin/data-requests` | Privacy request queue | Status/type/search before paging | All authorized privacy requests |
| Admin `/admin/audit-trail` | Audit activity | All server-filtered pages, then current text search and sort | All authorized activity pages without table filters |
| Hospital `/hospital/dashboard` | Collection history | Complete selected collection period | Complete facility history |
| Hospital `/hospital/requests` | Blood requests | Status/component/search and sort before paging | All statuses for this facility |
| Hospital or admin `/inventory` | Component/group stock | Selected component | All components plus preserved unclassified legacy rows at the selected facility |
| Hospital or admin `/inventory` donation tab | Awaiting confirmation | Full pending set and blood-group/date controls | Full pending set at this facility |
| Hospital or admin stock-history dialog | Fixed component/group movements | Every movement for this stock identity | Same fixed stock context |
| Hospital or admin `/inventory-log` | Confirmed donations | Entire history with current blood-group/date controls | Entire facility donation history |
| Hospital or admin `/inventory-log` | Stock movements | Selected component/group and date order, every page | Every component/group movement, including legacy logs, at this facility |
| Donor `/donor/activity` | Donation timeline | Donation type/search/sort | All this donor's confirmed donations |
| Donor `/donor/requests` | Matched requests / past responses | Current tab/component/radius/search/sort | All requests already authorized in this donor's matched feed, including the active commitment |
| Donor `/donor/alerts` | Inbox | Current unread/all filter and sort | All this donor's updates |
| Donor `/donor/privacy` | Privacy request history | This donor's complete history | Same donor-only context |

Admin inventory/history routes reuse the hospital views and controls. Unbuilt
ScreenStub routes, summary/KPI cards, editable settings/profile forms, maps,
public marketing content and the developer Gallery are not record tables and do
not get misleading export buttons.

The audit screen's on-screen text search remains page-local; a filtered export
applies the same text predicate to all server-matching pages. Account history
and audit exports use the existing protected endpoints and their redacted,
verified-context responses. They do not fall back to raw blocks or private
context collections. All-data exports preserve authorization checks on each
read. Active source failures disable controls; a later-page failure discards the
report instead of downloading only the pages already fetched.

`services/tableExports.js` traverses donation, activity, account-history and
movement cursors. Movement reads use at most four stock groups concurrently.
Receipt keys, claims, schema fields and security rules are unchanged. Existing
pending-list loading also reads all confirmed donation IDs so older confirmed
visits cannot reappear as pending merely because the display loaded 50 records.

## File and print behavior

CSV uses a UTF-8 BOM, CRLF records and escaped quoted cells, preserving commas,
quotes, line breaks and Unicode. User text beginning with spreadsheet formula
operators is prefixed with an apostrophe; numeric negative unit changes remain
numeric text. CSV dates retain full ISO timestamps.

The print view escapes all strings, loads no external assets, repeats column
headers across pages, wraps long fields, hides its controls in print and includes
page numbering. Human-readable date/time cells use Asia/Manila (PHT); printed
record counts match the chosen complete dataset. Empty filters produce a
header-only CSV or an explicit empty print report; All data remains available.
No export mutates the underlying records, changes filters or permissions, or
adds a durable data-access audit operation. The existing FR-042 work remains
partial rather than being claimed complete by client exports.

## Theme and support access

Landing and news navigation now include the existing `PubThemeToggle`, visible
on phone and desktop. Missing routes use AuthLayout, which also supplies a
navbar/theme control. Auth, partner, privacy, welcome, donor and staff navigation
retain their existing toggles and saved theme behavior; Gallery still shows both
component themes intentionally.

`SupportContact` renders “Any questions? Contact us at dugoplushelp@gmail.com”
with a mailto link in landing contact content, public auth chrome and donor/staff
surfaces. Privacy and blocked-account links use the same mailbox constant. The
current notice version is `2026-11-03`; historical acceptance records remain
unchanged. No email is sent by this task.

## Verification

The feature is checked with production build, compiled-output inspection,
traceability validation and all 123 regression tests. Five dedicated report tests cover
CSV quoting/Unicode/formula handling, escaped multi-page HTML, full cursor
traversal and failure/repeated-cursor handling.

Real app browser checks use only fictional accounts and data in local Auth and
Firestore emulators. Fixtures exceed visible pages: 35 accounts, 42 account
history events, 57 global audit events, 137 donations, 142 stock movements and
67 donor alerts. Both formats are checked for every view in the matrix;
filtered/all row counts, redacted contexts and later-page failure behavior are
asserted, including empty filters, blocked popups, server-side audit filters, cross-role denial and the four auth/persistence smoke checks. Eighteen role/theme/width and eighteen public route/width checks pass. Two printed reports are saved as actual multi-page PDFs, extracted and
rendered for layout inspection. Browser checks also cover mobile/dark controls,
public theme persistence, support links, missing configuration and the repository
auth/profile-persistence/verification smoke list.

These checks do not claim physical Android/iOS print support, production quota
capacity or production smoke. Print/PDF uses the browser's available print/save
options. No new library, backend capability, rule or index deployment is needed
for this frontend feature; the previously merged D63 Worker/rules/Hosting rollout
remains a separate release requirement.

The local harness and generated test reports are under
`/private/tmp/dugo-exports-qa`; no mock or emulator fallback ships in the app.
