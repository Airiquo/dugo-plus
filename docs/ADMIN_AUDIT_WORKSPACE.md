# Admin Audit Trail workspace

The `/admin/audit-trail` workspace leads with the action, affected account, current administrator and occurrence time. Its centered detail dialog shows the verified reason and before/after access state; technical hashes are in a disclosure. Existing routes and authorization stay in place. D56 covers FR-035/044/045 and NFR-15/20/29; these remain partial pending production verification.

## Read behavior

- `GET /audit/activity`: verified Active admin only; fixed 25-event pages plus one continuation row, ordered by `createdAt DESC, sequence DESC`. Exclusive cursors prevent overlap at equal timestamps.
- Account, administrator, event and inclusive date filters run on the server across history and persist in the URL. A range error preserves the form. Filters reset pagination.
- Text search and ascending/descending table sorting operate on the current page only; the interface states this boundary. Missing identities sort last. Mobile has equivalent sorting controls and a locally scrollable table.
- Manual refresh replaces the previous five-second whole-chain polling. Full-chain verification remains explicit, with independent errors/retry and an honest result.
- Existing `/audit/blocks` and account-history responses remain compatible with older clients. The new client requires `activityVersion: 1` and fails explicitly on an older Worker.

## Private context and bounds

Current identities are resolved from at most 500 user document names. Only those IDs are cached in the isolate for 60 seconds, scoped by project and stable audit HMAC configuration. Explicit account/actor filter IDs resolve even outside that directory. Fresh referenced profiles are allowlisted; unresolved, missing and erased identities remain unavailable. Names reflect current profiles, not historical identity snapshots.

Private reasons/statuses are read from erasable sidecars and authenticated against `contextHash`. Pending or completed actor/subject erasure tombstones suppress context immediately. A mismatch never displays untrusted context. Legacy records remain explicit about absent reasons. Context verification does not claim full-chain integrity. No new immutable PII fields or client read/write permissions are introduced.

`getDocuments` deduplicates at most 200 paths and chunks them into 100-document REST batches; the activity page needs at most 125 unique paths. Existing account history also batches private sidecar/tombstone reads. The 25-account emulator stress check uses five external service requests, including authentication/profile authorization, query and directory lookup.

## Validation

- 109 matching/account/UI-ordering/Firestore/audit unit and regression tests pass.
- Seven actual REST-emulator account/audit scenarios pass: rejected invalid/donor/suspended callers, combined filters, tied-timestamp 25+2 pagination without overlap, immediate tombstone suppression, valid retained chain, and capability flags.
- Frontend production build, Worker dry-run and docs validator pass. The existing frontend chunk-size advisory remains.
- Actual screen/shell/components were inspected with isolated fictional service/auth fixtures outside the repository. No fixture bypass ships. Checks cover account filters, page navigation, both sort directions/missing identities, date validation/empty results, reason details, privacy/mismatch states, verification retry, keyboard dismissal/focus, mobile dialog, dark mode and 390/768/1024/1440px overflow.
- No authenticated production signup/profile-save/reload/verify-email smoke was performed. No real account was modified. These checks still require an appropriate session and the deployed Worker.

## Coordinated rollout

1. Merge this feature through protected integration PR checks. Never commit the feature directly on integration.
2. Deploy **only additive indexes** from the merged configuration and wait for the eight activity indexes to be ready. Do not delete unrelated deployed indexes.
3. The owner of the existing `dugo-matching` Worker deploys that exact merged revision with its existing secrets. Preserve `AUDIT_HASH_SECRET` and the production Firebase project; do not replace the Worker in another account.
   ```sh
   git fetch origin
   git switch integration
   git pull --ff-only origin integration
   npm ci
   npm run worker:deploy
   ```
4. Verify public `/health` returns `accountOperationsVersion: 2`, `accountProfileVersion: 1`, `auditActivityVersion: 1`. These are capability markers, not proof of exact build or signed-in behavior. Unauthenticated `/accounts/profile` and `/audit/activity` should be 401, not 404. Run an authenticated admin read/filter/detail/verify smoke and existing account operations smoke.
5. Deploy Hosting from clean merged integration under owner override D37; verify served build identity/cache headers. Coordinate any pending profile-edit rules rollout in Worker → Hosting → rules order, following its existing handoff.

The available Cloudflare account previously returned provider error 10007 (“This Worker does not exist on your account”). Worker deployment and dependent Hosting remain blocked until the owning account deploys this revision. The frontend must not be released first.
