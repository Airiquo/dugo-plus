# Donor workflow overhaul — 2026-11-02

D42 adds a single active donation, detailed request review and a contextual inbox.
D43 removes donor rewards. Existing records are retained for historical data export.

## Local development

`npm run dev:donor-api` starts a loopback-only API at 127.0.0.1:8788 using the
operator's existing Firebase CLI session. `web/.env.local` may set
`VITE_DONOR_RESPONSE_ENDPOINT=http://127.0.0.1:8788/donor/respond`; no operator
credential is sent to the browser. The API verifies the Firebase token and email,
then runs the same transaction handler as the Worker. It uses the configured
Firebase project, so accepted responses/read-state changes persist there.

## Security and lifecycle

Only Pending matches on open requests can be answered. A donor may accept one
active request across tabs/devices. The transaction reads a singleton lock and
all legacy Accepted matches, plus request/donation/screening state, before writing.
Fulfilled/cancelled requests, confirmed donations and Deferred/Rejected screening
release a prior commitment. Acceptance and both consent records commit together.
Retrying the same response is idempotent. Decline requires no data-sharing consent.
A donor can explicitly withdraw an unconfirmed active donation after confirmation;
this atomically revokes its consent records and clears shared coordinates. The
hospital sees the updated Declined response; no delivery provider is invoked.

The production Worker must be deployed before the new rules/frontend: direct
donor response writes are denied by the updated rules. Do not claim production
rollout or cross-device enforcement on the old deployed rules. No production
Worker, rules or Hosting deployment is included in this local change.

## Experience

Requests separate available matches, the active plan and past responses. Details
show real facility/contact/location, component, units, priority, posting date,
response, eligibility and next steps. No patient details or invented appointment
time is displayed. Filters use component-aware matching. Compass centers and
zooms to at least 16; expansion uses icon controls. Controls have accessible names.

Alerts show hospital/request context, unread state and links to the exact request.
Read state changes are owner-checked by the donor API. All dropdown carets in donor
screens use a wrapper centered on the actual select, independent of label/errors.

## Verification

- Production Vite build and `node tools/check-docs.mjs` pass. The existing large
  chunk advisory remains. Compiled assets include the new Requests/Alerts screens,
  compass/expand controls and request-detail dialog; no donor reward copy is shown.
- `npm run test:matching`: 76 passing tests, including 9 donor response/read tests.
- Profile photo regressions: 2 passing tests.
- Firestore rules: 212 passing checks, including direct donor response/lock denials.
- `npm run test:donor:emulator`: 4 passing real REST transaction tests. Competing
  acceptances yield one winner; failed consent commits leave no partial match or
  lock; withdrawal revokes consent and releases the next acceptance; read-state
  writes are owner-only; invalid/unverified route tokens are rejected.
- Existing account REST transaction suite: 4 passing tests.
- Browser using real Firebase SDKs and disposable Auth/Firestore emulators:
  sign-in lands on `/home`, reload reads saved details, a city edit persists across
  reload, an unverified account stays at `/verify-email`, and an unconfigured
  app renders NotConfigured. No production accounts are used for this smoke.
- Browser read-only review with the seeded `donor@dugo.com` account: Requests,
  Alerts and Activity render in both themes at 1440/768/390/360px without horizontal
  overflow; existing commitments are preserved and block another acceptance.
- Isolated browser service fixtures exercise empty/error/retry states, deep links,
  acceptance requiring three explicit consent choices, failed-save recovery,
  withdrawal confirmation, unread/read alerts, profile/filter caret geometry,
  aligned search icon, mobile list/map switching, compass zoom to 16 and Escape
  collapse. The native detail dialog stays inside the phone viewport. These fixture
  transitions do not modify the account's real responses or read state.
- Screenshot/harness evidence: `/private/tmp/dugo-donor-overhaul/` and
  `/private/tmp/dugo-seed-donor/overhaul-*.mjs`.

The local app remains on port 5173 and its authenticated donor API on 8788.
Worker, rules and Hosting production deployments have not been performed.

## Activity and lifeline visual refresh — 2026-11-02

Activity now shares the donor hub hierarchy: factual visit/unit/latest-visit
summary, year-grouped history with expandable date/location/confirmation details,
hospital/type search, donation-type filter and a dedicated readiness panel.
The existing eligibility calculation and data services are unchanged. A shared
`BloodlineMark` SVG replaces the plain blood-type pill in Requests and appears in
Activity; a token-colored drop, continuous pulse line and connection nodes remain
legible in both themes. No reward UI is introduced.

Build/docs checks pass. Actual SDK/browser review verifies both themes at
1440/1024/768/390/360px with no horizontal overflow, visit expansion, hospital/type
search and filter reset, select-caret geometry and the shared emblem. Isolated
service fixtures cover loading, empty, error/retry and deferred-readiness states;
retry restores real history. No data-service or eligibility behavior changed.
Proof images: `/private/tmp/dugo-activity-refresh/`.

## Expanded test data — 2026-11-02

Seeded 45 additional clearly labeled records in the configured `dugo-plus` project,
without overwriting earlier commitments or creating rewards/provider deliveries.
`donor@dugo.com` now has 11 confirmed donations, 14 units and history across
2024–2026; hospital/type searches and expanded details have varied records.

Additional dedicated test donors:

- `donor.new@dugo.com`: verified, no donation history, two pending requests and alerts.
- `donor.deferred@dugo.com`: verified, recent whole-blood donation and pending requests.
- `donor.unverified@dugo.com`: held at the email-verification gate.

Credentials are supplied to the owner in chat, not stored in source. Fixture
manifests remain in `/private/tmp/dugo-seed-donor/`; no source-only flag is needed
to see these records. Pending responses are left available for manual testing.
