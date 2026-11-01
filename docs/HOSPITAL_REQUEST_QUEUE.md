# Hospital request queue — 2026-11-01

| Item | Applied design / scope |
| --- | --- |
| Trace | FR-016 facility request listing/management; FR-037 unchanged urgency-first ordering; NFR-23 scannability; NFR-29 browser layout. |
| Hierarchy | Blood type and component share a primary identity cell; request suffix is secondary. Units use aligned, tabular numerals. Priority and request status remain separate. |
| Status language | Stored `urgent` request status displays as **Open** to distinguish an open request from its urgency level. Existing stored values, query filters, statuses and transition permissions are unchanged. |
| Current-view context | Request count, requested units and urgent/stat count derive from the loaded status view after search/component filters. They include all matching pages, not just the current page. They are not facility-wide counts or inventory. Loading/errors show a dash rather than a false zero. |
| Finding a request | Local search by ID, blood type, component, priority and status; component filter; status tabs; 10/25/50-row pagination. Existing server-side facility/status scoping remains. No additional Firestore access, export or bulk action. |
| Update intent | Selecting a new status changes a draft only. **Apply** performs the update. Buttons are disabled while a write is pending. Fulfilled/cancelled require a named in-app confirmation dialog; cancelling keeps the existing record. Failed updates retain the draft and show a retryable inline error. |
| Modal accessibility | Native `<dialog>.showModal()` provides background inertness and focus containment. Initial focus is **Keep current status**; Escape cancels; cancellation is blocked while saving. Focus returns to Apply after cancellation, or the active view tab when the row leaves the queue. IDs derive from the component name. |
| Table accessibility | Native table headers; unique action names include request suffix; keyboard status tabs support arrows/Home/End; labeled filters and pagination; status/error announcements. The scroll region is keyboard reachable at intermediate widths. |
| Responsive treatment | Full table at desktop widths, contained horizontal scrolling at intermediate widths, stacked request cards below 700px. At narrow phone widths, status select and Apply stack with 44px controls. Confirmation buttons keep the same visual and keyboard order on phones. Page itself does not overflow horizontally. |
| Visual language | Existing care tokens: white/lavender panels, crimson type accents, restrained priority markers, blue/green workflow badges, consistent 12–28px spacing and thin separators. Shared base CSS untouched. No moving effects on request values or controls. |
| State coverage | Initial empty, no filtered results, loading skeleton, load failure/retry, missing facility, unavailable immediate matching, closed request, saving, update failure/retry and success notice. |

## Verification

| Check | Result / limit |
| --- | --- |
| Fixture boundary | Actual production page/components rendered by a separate temporary Vite harness; explicit fixture banner; no shipped fixture route, auth bypass or live database mutation. |
| Desktop and phones | 1440, 1024, 768, 390 and 360px: document `scrollWidth === clientWidth`; full-width desktop table; only the table region scrolls at intermediate widths. Phone cards and full-width actions inspected. |
| Search / component | Request ID search narrows to one row; unknown search produces the filtered empty state; Clear filters restores the queue. Whole-blood component fixture narrows to 4 requests / 8 units. |
| Pagination | 17 active fixtures: default first page 10, second page 7; selecting 25 rows displays all 17 with correct range/disabled navigation. |
| Status filters / keyboard | ArrowRight from Active selects Open and returns only stored `urgent` statuses. Fulfilled view displays the closed request without active management controls. |
| Explicit updates | Choosing Collecting produces zero writes. Apply saves and reloads; request status and success notice change. Failed first update retains its selection and succeeds on retry. |
| Dialog keyboard recovery | Escape cancels with zero fixture writes and returns focus to Apply. A successful final update returns focus to the active status tab when its row disappears. |
| Final status confirmation | Fulfilled opens the in-app modal without a write. Keep current status cancels with zero writes. Confirm performs one fixture write; the record leaves Active and appears under Fulfilled. |
| State checks | Empty/loading/load-error/retry/missing-facility/offline cases inspected. Loading/errors display summary dashes. Read retry returns the populated table. |
| Themes | Light and dark inspected; status labels remain legible against their theme token backgrounds. |
| Automated / compilation | `npm run test:matching` (35 existing tests); `cd web && npm run build`; `node tools/check-docs.mjs`; compiled output contains queue/dialog styles and labels. |
| Still unverified | Real hospital staff account reads/writes, network latency, claims and persistence against production. No staff credentials provided. Fixture checks do not establish those results. |
| Release | Per owner instruction D37, merge through a protected PR into integration, then build/deploy Hosting from clean integration. Run `tools/verify-hosting-build.mjs` against the live origin for exact bytes/cache headers. No rules/functions deployment. Actual deployment result is reported separately after execution. |

## Temporary release direction

| Decision | Operational effect |
| --- | --- |
| Owner: “deploy off integration for now” (2026-11-01) | Integration is the active frontend release source until the owner changes this instruction. This supersedes the main/prod promotion path for the current temporary workflow; PR protection and checks still apply to integration. Do not advance main/prod for this queue release. |
