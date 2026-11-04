# Request responses and completed donations contract (D79)

Owner answer, 2026-11-04. This contract supersedes separate collected/stocked
workflows for request-linked donations. Implementation branch:
`feat/request-donation-completion-nov04` (integration base `610b561`).

## Canonical completion and compatibility

`isCompletedDonation(data)` in `web/src/utils/donationCompletion.js` is true for
`status === 'Completed'` OR an existing `confirmedAt` timestamp. Legacy confirmed
records remain completed history; reading or replaying them never adds stock.
New records write `status: Completed`, `completedAt`, `completedBy` AND retain
`confirmedAt`, `confirmedBy` as compatibility aliases of the same instant/actor.
The document ID stays the match ID. One match permits at most one donation.

Match `donationStage` progresses Responded → Screened → Processing → Completed.
Legacy `screeningStatus: Cleared` maps to Screened. Staff can end any unfinished
accepted attempt as Deferred (required `deferralReason`); Deferred and Rejected
are terminal for that match. Reacceptance is allowed for donor Declined/Withdrew/Expired
responses on an active request, with fresh guidelines/consents, but never for a
Deferred, Rejected or completed attempt. Donor withdrawal is represented by
`responseStatus: Declined` plus `withdrawnAt`; displayed as Withdrew. A fresh
acceptance clears withdrawnAt and returns to Responded. Legacy Declined without
withdrawnAt remains Declined, never inferred as a hospital rejection.

## Atomic completion

The existing authenticated `/inventory` `confirmDonation` action remains the
write seam. `units` is required, positive, whole actual collected units.
Staff writes send `acceptanceVersion` from the response DTO (0 for legacy
acceptances). A changed version rejects stale writes, including old receipts.
It validates active staff claims/profile, facility scope/status, active donor,
request, acceptance, both current consents, Processing stage, component/group
compatibility and eligibility. One transaction creates donations/{matchId},
updates donor lastDonationAt and match stage, releases its commitment, increments
`hospitals/{h}/inventory/{component}_{actualDonorBloodType}`, creates its log with
BOTH donationId and requestId, and creates retry receipt/audit outbox records.
The donor profile and donorCommitments lock serialize acceptance vs completion.
Deferred creates no donation/stock and releases only its own commitment.

## Stable authorized directory/read seam

`POST /hospital/donations` with `{ hospitalId, donorId?, requestId?, donationId?,
after? }`; `listHospitalDonations(input, {signal})` in
`web/src/services/hospitalDonations.js`. Response `{ok, rows, nextCursor}`.
Lists use document-name cursor order, 25 rows plus one sentinel, AND equality
filters; no polling or unbounded scan. donationId returns at most one row.
Each row contains id, matchId, requestId, donorId, hospitalId, bloodType,
component, units, donationDate, completedAt, completedBy, legacy, status
(`Completed`). Dates are ISO strings/null. Legacy completion aliases are mapped.
No list exposes a donor profile or joins per-row profiles. Directory can filter
by its consent-authorized donorId and must retain its own consent boundary.
The Worker validates current active claims/profile/facility and exact scope on
every call. This history seam exposes facility donation records only.

`POST /hospital/donation-details` with `{donationId}` is the on-demand detail
seam; `readHospitalDonationDetails(donationId, {signal})` returns `{ok, donation,
request, donor, privacy}`. Request contains id, bloodType, component, quantity,
status. Donor is an allowlisted name/contact/group/city object only with current
match-specific Data Sharing consent and an active, unerased donor. Otherwise
`donor: null` and `privacy: consent-required|profile-unavailable`. Facility
history remains visible without private profile access. No cross-facility reads.
Movement details use their linked donationId to call this same seam.

No route here creates a donor directory. No production deploy or live migration
is performed. Existing confirmations are preserved without restocking.


## Consent history and read costs

Fresh acceptance archives any previous deterministic consent at
`donorConsents/{matchId}_{suffix}_v{previousAcceptanceVersion}` with its grant,
revocation, acknowledgment and acceptanceVersion; the current deterministic
record is renewed atomically. Withdrawal revokes the current consent and clears
shared location. Archived grants stay revoked and are never profile-access gates.

Response pages use one match query (26 maximum) and at most three exact-reference
IN queries (25 maximum each) for donation projections, consents and permitted
profiles, plus three fixed authority reads. Donation lookups apply only to legacy
Accepted rows without a stage; new stage projections need no donation query. Historical confirmations project
Completed without restocking or per-row reads. Deferral reasons are redacted
when current profile consent is unavailable. A facility donation history page
uses two authority reads plus one 26-record query, with no donor profile joins.
On-demand details are a fixed number of scoped reads. No new polling is added.
The existing donor feed supplies a newly completed donation's clock to eligibility
without another profile subscription. Donor history resolves new components from
the donation itself and batches legacy owner-scoped match queries in groups of
10; a 30-record batch was rejected by the current rules evaluator, so the verified
smaller query is retained. The pre-existing donor feed/history remains proportional
to that donor's own history. The legacy acceptance safety scan is capped at 100
accepted matches and fails closed for support review beyond that bound.

## Verification and handoff

- Results: **146 unit tests, 27 focused REST/SDK emulator tests and 227 rules checks pass**.
- Integration base verified as local/origin `610b561`; isolated worktree
  `/Users/pol/.codex/worktrees/b896/dugo_mobile_web`.
- `npm run test:matching` includes completion/reacceptance/eligibility and donor
  request predicates; the focused completion emulator command is
  `npm run test:completion:emulator`. The actual local run used a temporary config
  with unique localhost ports 18894–18897 and demo-only projects.
- Real REST emulator cases cover competing acceptances, completion vs acceptance,
  withdrawal vs completion, fresh consent/archive/reset, stale staff versions,
  terminal deferral, replay, rollback, exact donor group/component stock, linked
  movement context, legacy completion projections, paginated history, consent
  revocation, allowlisted fields and current claims/profile/facility boundaries.
- Donor Firebase-SDK history tests exercise owner-scoped reads against the real
  rules, preserve 31 legacy records plus a new completion, and assert bounded
  legacy batches and zero new-record match reads.
- Firestore rules remain unchanged: direct donation/match/inventory writes stay
  denied; existing 227 checks pass. No new rules permission is required.
- Vite production build, Worker dry-run bundle, docs validator and diff whitespace
  checks pass. Existing large-bundle warning remains.
- Browser/state/keyboard/mobile/theme checks and the four live auth/manual smoke
  steps have NOT run. The CUA inventory reports “Local browser use is disabled
  in Work settings”; this isolated worktree has no `web/.env.local`. The missing
  credential gate is unchanged. The reference screenshot script also cannot run
  because Python Pillow (`PIL`) is unavailable; no mockup/base-style edits or
  reference images are included. No live account, data, merge, push or deployment
  was performed.

Rollout: deploy the additive donation equality indexes before using the new
history filters, then coordinate the Worker and web build. Existing deployed
rules must retain the server-only protected writes. An old client cannot skip
Processing; an old staff tab cannot modify a newly reaccepted response. Staff
may advance a historical Cleared-but-uncompleted match from Screened to Processing
before recording Completed. Existing donation records never need a stock replay
or migration. Rewards and other lifecycle plans remain outside this flow.
