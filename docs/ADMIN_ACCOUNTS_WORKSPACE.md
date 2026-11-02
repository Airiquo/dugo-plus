# Admin Accounts workspace — batch 2 (D42)

| Scope | Detail |
|---|---|
| Owner request | Continue Batch 2 in a separate worktree, 2026-11-02. |
| Branch | `feat/admin-accounts-ui`, based on integration `a9f90bb`. |
| Requirements | FR-040 account management; supporting FR-035/045 account history; NFR-20/29 usability/browser access. |
| Screen | `/admin/accounts` including creation, confirmation and account-history overlay states. |
| Boundaries | No global Audit Trail, Dashboard, Data Requests, Settings or Profile redesign in this batch. No deployment or real account mutation. |

## Behavior

| Area | Result |
|---|---|
| Directory | Search name/email/account/facility ID, role/status filters, clickable status totals and 10-row pagination. Counts explicitly describe loaded accounts. |
| Visible actions | View history, Suspend, Remove access, Restore, Delete sign-in. Unsupported actions remain disabled; keyboard-reachable Action availability disclosure explains each restriction. |
| Protected states | Own/admin/unknown-role accounts, erased profiles, provisioning/deleting/deleted sign-ins and unsupported states cannot be mutated from this screen. Server authority remains decisive. |
| Hospital setup | Centered native dialog with grouped facility/person/sign-in fields. Required labels, input-linked errors, first-invalid-field focus, coordinate bounds and facility-ID validation. Password is masked and cleared on close/success; failed submissions retain the draft in memory. |
| Confirmations | Identity and access status precede the action explanation and reason. Destructive changes require a reason; restoration accepts an optional note. Busy dialogs cannot be dismissed. |
| Operation results | Uses existing v2 services and retry identity. Pending/network errors leave the form open for retry. Completed mutations with queued audit delivery are described as completed with activity awaiting delivery. |
| History | Current account facts plus events affecting that account; current administrator, timestamp, reason and before/after access state. Missing historical context is explicit. Links to the unchanged global verifier distinguish context checks from full-chain verification. |
| Read contract | `GET <VITE_ACCOUNT_SERVICE_URL>/history?accountId=<uid>[&before=<sequence>]`; requires a verified active administrator. Returns `historyVersion: 1`, up to 25 events, and `nextBefore`. No fallback to unfiltered audit blocks. |
| Privacy | Immutable chain unchanged. Sidecar details are returned only when their context digest verifies and neither actor nor subject has an erasure tombstone. Returned identities are current profiles, not historical snapshots. |
| Read bounds | One indexed page of at most 26 blocks; at most 100 administrator profiles for current actor resolution; context/tombstone reads only for returned events, deduplicated within the request. Administrators outside that bound or erased/missing profiles are shown as unavailable. |
| Known limits | Directory retains the existing all-users service, with client-side filters/pagination. UI does not guarantee immediate multi-admin synchronization; Refresh and server validation handle stale rows. No automatic polling of private history. |

## Verification

| Check | Result / limits |
|---|---|
| Production build | Configured and missing-Firebase builds pass; existing large-chunk advisory remains. New UI/history strings checked in compiled assets. |
| Unit/regression suite | 71 pass: existing 64 plus 7 action/history tests. Covers transitions, protected states, scoped/cursor-bounded queries, redaction, digest mismatch, legacy context and private-field whitelisting. |
| REST emulator | 5 pass using Homebrew Java explicitly on PATH. New HTTP case checks suspended/donor/unauthenticated rejection, malformed cursor, subject isolation, 25+2 record pagination, actor resolution and erasure suppression against actual Firestore REST transactions. Identity Toolkit is simulated; no external provider call. |
| Worker dry-run | Pass with lockfile Wrangler 4.152.0; 92.80 KiB bundle. No upload/deployment. |
| UI fixtures | Isolated local Vite harness imports actual Accounts, AppShell, components and CSS. Auth/services are substituted outside the repository; banner identifies fictional data, and CSP blocks external connections. Fixture success does not establish production persistence. |
| Primary paths | Empty creation gives six invalid fields and focuses facility name. Valid fixture creation closes dialog and reports queued audit delivery. Suspension requires reason; completion updates the directory. Account history loads and paginates. |
| Recovery paths | Creation failure retains draft/password masking, then retry succeeds. Mutation interruption preserves reason, then retry succeeds. Older-Worker history error shows Retry and no unrelated records. Empty and failed directory states inspected. |
| Keyboard | Native modal focus containment, Escape dismissal and trigger-focus restoration inspected. First-invalid-field focus verified. Disabled-action explanations remain keyboard-reachable. |
| Responsive/theme | 390/768/1024/1440 CSS-pixel checks: no page-wide overflow and first-row action controls visible. Light and dark directory/dialog visual inspection. |
| Screenshots | Local proof files under `/private/tmp/dugo-admin-accounts-proof`; not production data and not shipped as application assets. |
| Live smoke | Not performed: no active production admin test session/provider authorization. The batch-1 emulator auth smoke is prior evidence, not a fresh live test for this batch. |

## Rollout handoff

| Step | Required action |
|---|---|
| 1 | Merge through protected integration only after checks pass; no `codex/` branches or protection bypass. |
| 2 | Deploy the new audit composite index and wait until ready. |
| 3 | The groupmate owning `dugo-matching` deploys this updated Worker, retaining its current secrets and stable audit HMAC secret. V2 account operations must remain available. |
| 4 | Verify authenticated account-history responses have `historyVersion: 1`, then deploy the compatible frontend from clean merged integration under D37. |
| 5 | Complete outstanding D40 rules rollout in its documented order. No additional rules changes are introduced in Batch 2. |
| 6 | Perform authorized live creation/status/history/retry smoke. This document does not claim it has passed. |
