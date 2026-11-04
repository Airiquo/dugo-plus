# Hospital Donors directory (D82)

Implemented on `feat/hospital-donor-directory-nov04`, based on integration
`610b561`. The route is `/hospital/donors`, with a labeled Donors navigation
control inside the existing configured/authenticated/verified/hospital gates.
Each row has a contextual **View donor** button; the selected view has **Back to
donors**. Opening either view focuses its heading.

## Read contract and dependency

The published sibling contract was read from
`/Users/pol/.codex/worktrees/b896/dugo_mobile_web/docs/REQUEST_DONATION_COMPLETION_CONTRACT.md`
(`feat/request-donation-completion-nov04`). Its completion predicate is
preserved: `status === 'Completed'` or a valid legacy `confirmedAt` timestamp.
New canonical and historical confirmed donations are read together. Reads never
confirm, restock, migrate, duplicate or update donation/eligibility data.

This branch adds `POST /hospital/donors`, with body
`{ hospitalId, donorId?, after? }`, returning `{ ok, rows, nextCursor }`.
It stays compatible with integration's legacy confirmation documents while the
sibling write changes remain unmerged. It owns no completion/movement transaction
or request overlay. The sibling's `/hospital/donations` and donation-details
routes remain independently additive; integration must retain both route blocks.

The existing `donations` collection is the completed-donation record, not an
attempt collection. The directory reads only this facility's donation records,
not registered users or accepted/deferred matches. There is no new collection,
materialized directory, client profile permission or background polling.

## Bounded directory and privacy

The server validates the active hospital profile, non-erased account, matching
staff role/hospital claims and active facility on every page. It rejects hospital
substitution and filters selected history by BOTH facility and donor. The
endpoint has no administrator/global directory bypass. HTTP responses are
`no-store` through the existing Worker response helper.

Directory queries order facility donations by donor ID, with a maximum of 26
records (25 plus a sentinel). Donors are deduplicated before returning a page;
the next cursor excludes every visit by the last donor. A separate one-record
lookahead avoids a false last page when a donor has many visits. Pages can thus
contain fewer than 25 people. No total facility-donor count is implied. Selected
history uses facility+donor equality and exclusive document-ID cursor order,
25 records plus a sentinel. The new `donations(hospitalId ASC, donorId ASC)` index
supports the directory and the selected history scope.

One representative completed visit per returned donor supplies the directory
consent boundary. Its match ID must equal its donation document ID (or be absent
on legacy records). A batched document-name `IN` query checks those exact
`{matchId}_data-sharing` records: donor/match/type must match and `revokedAt`
must explicitly be null. Another bounded `IN` query reads only eligible profile
IDs. At most four queries plus the actor/facility reads occur per directory page;
all reads share one transaction, with no profile/consent N+1 calls. Private,
missing, suspended, removed or erased identities remain private. The allowlist
is full name, email, phone, blood group and city; no DOB, location coordinates,
status reasons or other user fields are exposed. A revoked representative visit
can leave identity private even when another historical visit has consent; this
conservative directory scope does not infer consent across visits.

Facility donation records remain available by donor reference without private
profile access, as specified in the sibling contract. Selected history returns
only completed records at this facility; another facility's donor/history
returns no rows. It does not reuse the directory's previously displayed contact
information in the history heading or exports.

## Filters and exports

Directory search is explicitly **on this page**, covering shared name/city and
donor reference, with current shared blood group or private/unavailable filters.
History has page-local donation/request ID search, blood group, component and
inclusive Philippine donation-date range. Clear controls reset filters. Sorting
uses the existing shared table/sort helpers and applies to loaded page records.
Counts say matching rows on this page, never a global search/count. Previous,
Next and Refresh are explicit; loading, empty, error/retry, disabled controls and
mobile card rendering use existing primitives.

**CSV** and **Print/PDF** use the existing TableExport/print preview and complete
cursor traversal. Export scope is explicit: all pages matching current filters,
or all pages with filters cleared. Filtered exports apply the same filter/order
helper to the complete authorized dataset. Scope never expands beyond this
facility or selected donor. Export data is fetched only when an export button is
pressed. A failed/repeated cursor aborts the whole export; it never downloads a
partial report. Directory exports repeat the server's allowlisted/redacted
identity, and history exports contain donation records only. CSV formula and
HTML escaping reuse the shared serializers.

## Verification and remaining review

- `cd web && npx vite build`: passed; existing large-bundle advisory remains.
- `npm run test:matching`: 133 existing regressions passed.
- `node --test web/src/utils/hospitalDonors.test.js`: 3 passed (complete export
  traversal, matching filters/order, PHT dates, redacted reports, escaping and
  failure without a partial export).
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8297 node --test worker/src/hospitalDonors.emulator.test.js`:
  6 real REST-emulator checks passed: consent allowlist/revocation, inactive and
  erased identities, staff/claims/facility isolation, unique directory pages
  with repeated donations, complete new/legacy selected history without writes,
  malformed/authenticated HTTP/CORS/no-store handling. Tests use unique fixture
  namespaces and never delete another test's data.
- Worker files pass `node --check`. Traceability and whitespace checks pass.
- Compiled output contains the Donors route/navigation, View donor, export scope
  labels, facility endpoint and responsive directory styles.

Visual/browser interaction review was attempted through the available computer
use tool and is unavailable: **Local browser use is disabled in Work settings**.
The local fixture-only preview is prepared at
`/private/tmp/dugo-donors-nov04-qa` (port 5279), including loading/empty/error
query modes. Desktop, phone/tablet, both themes, keyboard focus, navigation,
filter/pagination, CSV download and Print/PDF preview still need visual review.
No screenshot or physical-device pass is claimed. Shared mockup styles and
README reference screenshots are unchanged.

The four required signed-in smoke checks (donor sign-in destination, saved
values on reload, save surviving reload, unverified-account gate) were not run:
no authorized account/credentials or usable browser were supplied in this
session. Configured/unconfigured auth behavior is unchanged; no live-provider
verification is claimed. FR-020 and NFR-16 remain partial; phase counts do not
change. The feature is locally implemented and security-tested, with this
browser/live review outstanding.

Rollout: review/merge compatible source, deploy the additive index and wait until
ready, then deploy the Worker containing this endpoint, then Hosting. No rules
change is required. Preserve the sibling completion routes when collecting
branches. No push, merge, deployment or live data mutation occurred here.
