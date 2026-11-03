# Hospital branch reconciliation — D63

`feat/hospital-worker-reconciliation` combines `integration` (`da07d20`) with
`feat/f3f4f6f7f9f10` (`994fdcf`) in an isolated worktree. The seven content
conflicts are reconciled without replacing integration's account, audit,
matching, responsive shell or sorting work.

## Owner decisions and resulting behavior

- Facility address/location remain administrator-managed. Staff can view the
  saved map and edit facility name/contact at `/hospital/facility`. Personal
  account details remain at `/hospital/profile`; shared profile links retain
  that meaning. Hospital mobile navigation adds More for every new destination.
- Partnership plan management is removed: no plan route, navigation item,
  service, pricing promises or new staff subscription permission. Existing
  administrative subscription records and their prior rules remain untouched.
  Questions about self-service plan vocabulary/billing are descoped with this
  removed feature, not left as implied implementation defaults.
- The existing Cloudflare Worker owns screening, confirmation, transfusion and
  adjustments at authenticated `POST /inventory`. Its health response advertises
  `inventoryOperationsVersion: 1`. There is no browser-write fallback or Blaze
  dependency. All operations validate token claims and the current active
  profile; staff claims must agree with the profile's facility. The linked
  facility must be active.
- Stock is separate by component and blood group. IDs are
  `hospitals/{hospitalId}/inventory/{component}_{bloodType}`. Existing group-only
  stock remains unclassified/read-only and excluded from usable totals; it is
  never guessed, migrated or deleted automatically. Classification of existing
  real units requires a verified administrative data correction outside this
  change.

## Transaction and recovery contract

Confirmation reads the request, accepted match, both active consent records,
current donor group/profile, reference interval and screening result. It checks
current eligibility and creates `donations/{matchId}` using the actual donor's
blood group and request component. One Firestore transaction writes donation,
component/group stock, movement log, donor `lastDonationAt`, idempotency receipt
and two pending audit events (donation confirmation and stock receipt). All
reads precede writes. Current consents missing from older synthetic/legacy
matches block screening until fresh donor consent is obtained through support;
no consent is invented or automatically backfilled.

Screening writes only the result and actor alongside its receipt and pending
audit event; it cannot rewrite a confirmed donation. Transfusion cannot overdraw,
use another component/facility's request or exceed the request's remaining
quantity. `transfusedUnits` accumulates partial issues and the request becomes
fulfilled only when the complete quantity has been issued. Adjustments need a
reason; expiration removes units and stock cannot become negative.

Confirmation is idempotent by match. Other operation IDs bind the actor and a
client UUID; HMAC fingerprints reject reuse with changed input. Server-only
`inventoryOperations` receipts commit with domain writes. The browser retains
only a hashed request key and UUID in session storage for uncertain failures;
repeating the same details after a reload reuses the UUID. Credentials and raw
reasons are not stored there. Storage-denied browsers retain the ID in memory,
so recovery across reload requires available session storage.

The existing scheduled outbox processor appends events to the hash chain and
acknowledges delivery atomically. Event persistence is part of the stock
transaction; hash-chain delivery may occur on the following schedule. Existing
HMAC/redaction protections remain. Browser stock/log/donation/screening/clock
writes are denied, including administrator sessions. Staff can still update
request statuses; delivered-unit counters remain server-owned.

The UI uses one sorting model, complete paginated-query dashboard totals, a
separately paged display log, component selection and mobile table cards.
History summaries that load incrementally are labeled as loaded records.
New incoming decisions do not overwrite D27/D28/D41/D51. The pre-existing
continuous-motion D40 collision is renamed D64; D40 remains account operations.
The docs checker now rejects duplicate decision IDs and requirement conflict
markers.

## Local verification

- Production Vite build and `node tools/check-docs.mjs` pass. Compiled output
  contains the facility/inventory routes and omits the removed plan/account
  destinations. The dependency lockfile is retained from integration.
- 118 regression tests pass, including seven new operation tests for trusted
  authorization, atomic failure, actual donor/component identity, concurrent
  confirmation, partial issuance, screening and retry safety.
- 227 Firestore rule checks pass, including denied unrelated staff clock writes,
  administrator browser bypasses and forged operation/fulfillment records.
- All 22 Worker REST emulator tests pass: seven account, five donor, five matcher
  and five new inventory tests. New tests exercise real Firestore transactions,
  API token/profile/facility checks, atomic rollback, concurrent confirmation,
  independent component stock and idempotent audit-chain delivery.
- The two profile-photo checks and the incoming eligibility interval checks also pass.
- Wrangler 4.152.0 (the lockfile version) bundles the Worker successfully with
  `--dry-run`; no deploy occurs.
- Real browser/app smoke uses fictional accounts in isolated Firebase Auth and
  Firestore emulators: verified sign-in lands at `/home`; saved profile values
  survive reload; editing/saving persists across reload; an unverified account
  remains at `/verify-email`. Missing configuration still renders NotConfigured.
- Hospital browser checks cover seven routes at 390/768/1440px in both themes,
  mobile navigation, locked address/map, facility save/reload, complete 101-row
  dashboard aggregation, screening and selected-donation confirmation controls, and the authenticated browser service → Worker →
  Firestore confirmation. An unavailable response after a committed adjustment
  is retried after page reload with the same ID and changes stock only once.
  These are emulator/browser checks, not production or physical-device proof.

The isolated browser harness and screenshots live under
`/private/tmp/dugo-worker-qa`; it is not a production configuration or committed
app fallback. No real project accounts/data, provider configuration, credentials,
Firestore rules/index deployment, Worker deployment or Hosting deployment were
changed. Production requirement rows remain partial.

## Coordinated rollout

1. Merge through a protected PR into integration after its checks pass.
2. The authorized operator deploys the merged Worker with its existing service
   account credentials, Firebase API key and unchanged `AUDIT_HASH_SECRET`.
   Confirm `/health` reports inventory capability version 1. The existing outbox
   `state`/`nextAttemptAt` index is reused; this change adds no composite index.
3. Release the tightened Firestore rules and frontend together in a coordinated
   window. The new frontend requires the new Worker and never falls back to
   browser writes. Retain the latest integration indexes required by the
   previously merged audit work. Use integration as the temporary Hosting source
   under D37.
4. Run a controlled production staff/admin smoke: screening, confirmation,
   current donor/group/component stock, issuance/partial fulfillment, adjustment,
   retry and audit delivery; verify cross-facility denial. Verify legacy stock is
   explicitly unclassified before any administrative classification.

This task prepares the local merge candidate; it does not push the branch,
merge into integration or deploy it.
