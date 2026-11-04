# Data requests and response review

Implemented on `feat/data-request-review`, from integration `610b561`, in
`/Users/pol/.codex/worktrees/8028/dugo_mobile_web`. Decision D80 covers
FR-039/NFR-19; both remain partial pending authenticated production validation
and the existing compliance review. No phase count changed.

## Behavior

- Donor Privacy retains Access, Correction, Deletion and Export, and adds Other.
  Every submission requires nonblank written details, at most 2000 characters.
  The service trims text; Firestore rules independently reject empty,
  whitespace-only, non-string and oversized details.
- View sits immediately after each donor request title. Its native read-only
  dialog contains the original details, actual status, request ID, submission
  and response dates, response text, rejection category and recorded action.
  Pending and historical missing-response records have explicit messages.
  Escape, Close request and focus restoration use the existing dialog primitive.
- Admin has Open and Closed views. Closed means Completed **or Rejected**;
  Completed and Rejected remain distinct explicit status filters and export
  values. Rejection never deletes a request. Historical rejected records without
  the new category remain visible and retain their response and timestamps.
- The baseline/reference branch has no rejection presets. The owner authorized
  selecting them: More information needed (`InsufficientDetails`), Duplicate
  request (`Duplicate`), Outside Dugo+ data scope (`OutsideScope`), and Other.
  Rejection requires a category and written explanation for every choice,
  including Other. `adminNote` is the donor-visible explanation, avoiding a
  second competing free-text response. Completing an Other request supports
  the recorded action `Response` (Written response provided).
- Rules freeze closed records and original request fields, require the active
  administrator's UID and server resolution time, and continue denying deletes.
  Existing export/correction/guarded erasure actions and audit events remain.
  No notification code or Worker endpoint changes.
- Request reads use 100-document batches ordered by document ID, then retain
  the existing newest-first display. No timestamp index/migration excludes old
  records. Explicit history/refresh still reads the entire authorized result
  set to preserve filtering, counts and complete exports: total read cost is
  proportional to that history, rather than capped at 100. There is no polling
  or per-row profile/detail read. A later-page failure returns no partial result.
  Admin's existing single account-directory read is unchanged.

## Verification (2026-11-04)

- `cd web && npx vite build`: passed; existing large-chunk advisory remains.
- `node tools/check-docs.mjs` and `git diff --check`: passed.
- `npm run test:data-requests`: six checks pass. The actual service source runs
  in VM modules with Firebase/audit boundaries stubbed: supported types,
  rejected details/reasons, retained audit/action contracts, 101-record owner
  pagination, rejected normalization and failed-page behavior. The VM API
  prints Node's experimental-feature warning; no application runtime dependency.
- Isolated Firestore emulator on port 8184 (`demo-dugo-data-review`): all 258
  rules assertions pass. Added checks cover Other validation, owner/cross-donor/
  staff/removed-account scope, valid Other rejection, forged reviewer/rewritten
  request denial, rejected retention, historical readability, immutable closed
  outcomes and written-response completion. Existing rules coverage remains.
- Same isolated run: all seven `worker/src/accounts.emulator.test.js` checks
  pass, including erasure, audit outbox and sign-in cleanup regression.
- Existing account-action/export tests plus closed-view helper: ten checks pass.
  Compiled output was checked for Other, closed grouping, donor response text,
  rejection controls and the adjacent-title CSS hook.
- Native Firefox/Zen browser checks used synthetic services in an isolated
  preview on port 5198, importing these worktree screens/primitives/styles.
  Confirmed donor Other validation/submission, title-adjacent contextual View,
  rejected response/original request/status/date display, Escape and focus
  return; admin note/reason validation, Other rejection, focus on success notice,
  Closed grouping, explicit Rejected-only filter including historical records,
  disabled processing of closed records and labeled Back to requests. Filtered
  PDF preview contains both rejected records and new reason/response columns;
  Back retains the filter. Error retry, unavailable counts and donor empty
  history were checked. Light/dark controls worked. Responsive mode at 320/360px
  exposed the mobile record cards and explicit View controls in the AX tree.
- The actual compiled app on port 5199 renders the NotConfigured screen at
  `/donor/privacy` with all six missing Firebase variables listed. No
  unconfigured route bypass was introduced.

Native screenshots returned blank white images, and responsive-mode interactions
were unreliable. Pixel-level layout/overflow/theme verification and physical
device checks remain unverified; the AX checks are not a visual signoff. The
configured sign-in/profile reload/save/unverified-account manual smoke has not
run: no test credentials were supplied, and live-data mutation is excluded from
this task. The fixture preview does not establish production persistence.

## Rollout and handoff

No push, merge, deployment or live-data mutation was performed. Deploy the
updated Firestore rules with the matching frontend through the authorized
release process; no new index, Worker deployment or historical backfill is
needed. Older cached admin clients cannot reject without the new reason field
after rules tighten; refresh to the matching frontend. Existing closed records
remain readable, including older records without `rejectionReason`.

New source ownership: donor `Privacy.jsx`, admin `DataRequests.jsx`,
`services/dataRequests.js`, `utils/dataRequestReview.js`, privacy report columns,
the scoped rules block and associated tests. Shared-file changes were made
while holding `/private/tmp/dugo-nov04-shared-writer.lock` and released before
tests/waits. Integration/reference branch working files were never copied.
