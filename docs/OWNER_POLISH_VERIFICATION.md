# Owner-requested polish, 2026-11-04

Continue the settings/layout work at `0db771d` on integration-based feature
branches. Ratings/review content stay unchanged. The owner withdraws the
inventory-refresh fix because inventory works; no inventory write change is
included. Registration requires date of birth, gender and blood type.

## Landing (D91)

Global pause/theme controls restored. Cards have local pause/hover controls.
The request-to-donation steps are click-driven, with no scroll handler; perspective
copy/checks animate on change. Partners precede impact and platform. Ribbon
positions are fractional, retained in memory by name across remounts, and remeasured
on resize; arrows continue from the current offset. No rating/review copy changes.

Vite production build passes. Chrome fixtures pass at 390/1440px in both themes: global pause, click-driven steps, ribbon offset retention and no page overflow. Reference screenshot regeneration was attempted; Pillow is unavailable.
No phase counts change; broader usability/device acceptance stays open.

## Navigation (D92)

My profile is separate from Settings for donors/hospitals. Settings contains
Appearance and Privacy/Facility details respectively; visited panels retain drafts.
Legacy privacy/facility URLs redirect into the selected tab. Existing hospital
donor-directory route is retained. Sign out is separated by a divider and danger
text in shared account menus and donor profile actions. Admin navigation stays.

## Route loading and caching (D93)

Route chunks are present in dist. Hover/focus preloads code, never data.
Profiles/facilities/stock use a 30-second memory cache with concurrent-read
deduplication; stock listeners are shared and released on last unsubscribe.
Writes invalidate relevant reads. Session changes/sign-out clear data/listeners.
An aborted consumer receives AbortError without cancelling a shared reader.
Firestore's getDoc/getDocs API cannot abort the underlying transport. No profile
or health data is added to browser storage. Cache regressions pass (3 tests).
Configured live sign-in/save/reload/verification smoke remains to be run with
local emulator credentials; fixture checks are recorded separately.

## Identity (D94)

Email registration requires confirm password, DOB, gender and blood type, followed
by a review before account creation. Google still provisions after provider sign-in
and goes to /home; persistent completion prompts appear there and on Requests.
Existing acceptance validation stays. Admin hospital creation adds confirm password
without gender. Staff Accounts/Donor Registry, response cards/progress and the
account editor show gender and age derived with ageOn. No matcher contract change.

Donor location reuses HospitalLocationMap click/drag/keyboard placement and manual
coordinate fields, with validation/status feedback. City search goes through an
authenticated Worker endpoint to Photon (PH filter, 8 results, debounce/cache);
manual entry remains available. Phone input/paste is normalized with phNational
and saves use phE164. Birth date/blood group retain their existing first-save locks.
Gender is exported and erased with the profile; privacy notice/rules/schema move
together. Updated Worker and rules need coordinated deployment after review.

Verified locally on 2026-11-04: 264 rules assertions pass; 21 account and
consent-gated response/directory REST emulator checks pass. The actual App,
auth hook and data services (only Firebase initialization redirected to isolated
Auth/Firestore emulators) pass all four required smoke checks, plus reviewed
registration/identity locks, numeric paste, manual pin persistence, invalid
coordinate errors and missing-configuration behavior. Harness/results are in
`/private/tmp/dugo-owner-auth-smoke/` and `/private/tmp/dugo-owner-*-rest.txt`.
Live Google provider, production deployment and physical-device checks remain.

## Queue and hospital toolbars (D95)

Donation-stage filters distinguish Not screened, Screened (including legacy
Cleared), Processing, Deferred and Rejected. Display/export use the same derived
values. Completed rows leave pending even before history refresh. Active queue
listeners receive changes from other sessions, prune stale selections and close
stale screening drafts. Refresh reattaches after an error; subscriptions release
on unmount/sign-out. No polling. Initial reads remain one facility-request query
plus one match query/listener per returned request, then changed documents;
completions retain the existing history reload. No inventory mutation change.

History/queue search spans the first toolbar row; filters, sort and Export align
below in the same order at narrow widths. Requests uses full-width search and
wider status choices. Post-confirm success prose is removed; errors remain.

Queue verification: the actual application and Firestore SDK were exercised with
a verified emulator hospital identity while another session updated Screened →
Processing → Deferred → Completed. Selected filters updated without refresh, stale
selection cleared, deferred selection disabled and completion left the pending
list before any history record was added. No stock mutation was performed.
Harness: `/private/tmp/dugo-owner-auth-smoke/queue.mjs`.

The full regression command passes 157 tests after adding cache, registration,
city-search and queue-stage coverage. Vite build and traceability checks pass;
compiled output contains route chunks, stage-filter labels and stacked-toolbar
rules. Responsive fixtures wait for real route content after lazy loading.

Final responsive fixtures: 80 fully loaded route layouts at 320/390/768/1440px
in both themes pass without page overflow or JavaScript errors. Phone profile,
queue, history and desktop table screenshots were inspected. Motion follow-up
keeps elapsed counter progress through pause/resume and adds local destination/
compatibility card controls. Review content/aggregate calculation stay unchanged.

Final motion checks pass: counters freeze/resume from elapsed progress, card hover
and explicit pause remain local, arrows retain their offset across a news-article
unmount/remount, and light/dark phone/desktop landing checks still pass.

Final review fixes the long hospital history label wrapping, removes stale
position-based sidebar styling, associates phone-correction length errors, and
forwards city-control root/input attributes through their respective elements.

Phone validation retains 9-digit Philippine landlines and 10-digit mobile
numbers; administrator saves keep the editable form in national digits while
persisting E.164. The inline administrator contact error is associated with its input.

## Review handoff

Combined review branch: `feat/owner-polish-review`, in
`/Users/pol/Documents/dugo_mobile_web/.worktrees/owner-landing`.
The existing settings/export branch (`0db771d`, based on integration `a7fa998`)
was resumed without altering the original worktree. Workstream branches:
`feat/owner-landing-controls`, `feat/owner-navigation`,
`feat/owner-route-loading`, `feat/owner-donor-identity`, and
`feat/owner-queue-filters`. They retain the preceding work in the requested order.

Final checks: Vite production build; compiled-output inspection; check-docs;
157 regression tests; 6 data-request tests; 264 rules assertions; 21 account/
response/directory REST emulator checks; four required actual-app Auth/Firestore
smokes; actual-app live queue changes; 80 fully loaded responsive/theme layouts;
16 final targeted layouts; hospital password mismatch/no-gender verification;
and landing pause/remount/offset checks. Review/aggregate rendering and landing
content data were compared directly with `0db771d` and remain unchanged.

No deployment, push or protected-branch merge is included. Review then roll out
Worker, rules and frontend together. Live Google-provider/production smoke and
physical-device checks remain. The README screenshot generator was attempted
but cannot run without Pillow; shared mockup styles were not edited, and the
application screenshots above cover the changed screens.

## Integration reconciliation

Reconciled with integration `776310e`, retaining its session history guard,
lasting-action confirmations, icon-only mobile staff navigation and 25/50 km
discovery. The existing D86–D90 decisions keep their identifiers; this work uses
D91–D95. Donor profile logout now honors cancellation. The session-navigation
harness follows /home and the nested Privacy URL and covers profile logout cancel.

GitHub integration verification passes on reconciled commit `901f4ac`: both
required jobs (`checks` and `rules`) succeeded, including the complete security
and transaction suites. The merged local regression count is 162; the complete
session-navigation browser harness passes with the new /home/profile route.

Also retains integration `c93e853` (PR #61), which landed during CI: donor
response outlines remain on the dialog, with its accompanying documentation.

## Deployment verification compatibility

The owner authorizes deployment of merged integration. Route splitting moves
the logging source stamp from the entry bundle into a shared chunk. The verifier
now searches all generated JS and verifies remote hashes/cache policy for every
JS/CSS asset, including lazy pages. Deployment targets remain the existing Worker,
clean-project rules and both documented Hosting entry points.
