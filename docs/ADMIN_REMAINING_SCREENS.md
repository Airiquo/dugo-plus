# Remaining admin screen redesigns

## Data Requests — D57

`feat/admin-data-requests-workspace` redesigns the existing privacy queue with open-first status filtering, search/type filters, three actionable queue counts, full-filtered-result sorting before ten-row pagination, and equivalent mobile sort controls. Review uses the existing centered AdminDialog with busy dismissal protection and focus restoration. It shows the subject, request text, processor/resolved time and a two-step action/resolution composition. Closed requests are readable with disabled actions. Completion/rejection require a note; completion requires an explicitly recorded action. Erasure still requires a separate confirmation and reason; unavailable account details disable profile mutation controls.

Services, rules, routes and stored fields are unchanged. Existing data-request audit hooks remain best-effort. UI read-only/transition checks are not a new server-side guarantee. No production account was changed and no Hosting deployment is included. FR-039/NFR-19 remain partial pending production end-to-end validation.

Validation: frontend build/docs checks pass. Isolated fictional-data checks cover export/completion guards, closed/disabled actions, correction, erasure confirmation/reason, load/save retry, both date-sort directions before pagination, Escape dismissal, light/dark and 390/768/1024/1440px with no page overflow. The phone dialog fits at 354px in a 390px viewport. No service/rules code changed. Verify live processing under an appropriate administrator session before release.

## Dashboard — D58

`feat/admin-dashboard-overview` replaces the navigation-only dashboard with current privacy-open, Active-profile and hospital-staff-profile counts, the three oldest open privacy requests, current configuration values and direct workspace links. Counts are explicitly profiles rather than unique facilities. Each of the three existing services loads independently; a failed source is unavailable rather than zero. Snapshot time is a client refresh timestamp, not a server synchronization guarantee. No new collection, aggregate write, permission, invented trend or provider-delivery statistic is added.

Motion is limited to a small decorative care symbol with reduced-motion support. Verify live role-gated reads before production release; this batch does not alter the service layer or deploy Hosting.

Dashboard validation: build/docs checks pass; fictional fixtures verify exact counts (18 open / 15 Active / six hospital-staff profiles), oldest-first priority order, empty zeros versus failed-source dashes, independent-source retry, dark mode and 390/768/1024/1440px without page overflow. The public care logo asset is served by the existing Vite assets configuration.

## Settings — D59

`feat/admin-settings-workspace` groups the radius tiers and notification retry policy, with a draft-only search ladder/reach diagram and sticky Save/Discard controls. Existing tier/retry bounds and service writes remain unchanged. Blank retry-limit input is rejected explicitly; zero still disables retries. Add/remove respects 1–8 tiers and the 100km maximum, while validation rejects non-increasing radii. Defaults are staged, never saved automatically. Load failure locks editing and withholds the preview; save failure preserves the draft. Saved metadata remains readable in a disclosure. No server/rules/schema changes or new provider guarantees.

Settings validation: production build/docs checks and fictional fixtures cover non-increasing tiers, blank versus zero retry limits, saved readback, save-error draft preservation/retry, failed-load locking, defaults staging/discard, 1/8-tier limits and the 100km add limit. Both themes and 390/768/1024/1440px have no page overflow. The save toolbar was verified while editing lower fields on mobile; route-scoped root clipping permits sticky controls and mobile navigation scrolls away to avoid covering them. No production configuration was changed.

## Profile — D60

`feat/admin-profile-workspace` gives the administrator a dedicated photo/identity rail, a focused contact form, read-only account/access facts and an actor-filtered link to Audit Trail. Contact details appear first on narrow screens; the existing optional photo editor remains independent. Source read failure or a missing profile disables writes. Empty-name validation focuses the input, discard restores saved fields, failed saves retain edits, and post-save Auth/context/readback failures report a saved profile with incomplete refresh rather than pretending the write failed. Updated-at facts come from profile readback rather than a fabricated server timestamp.

No services, auth guards, claims, routes, Firestore fields/rules or photo-provider contracts changed. FR-047 remains done for its existing scope; production provider/readback and account permission smoke remains a release check. Existing global Audit Trail requires its previously documented Worker rollout.

Profile validation: production build/docs checks and fictional fixtures cover empty-name validation/focus, discard, successful saved readback, failed-save edit retention/retry, failed-load write blocking, saved-write versus failed-refresh feedback, the actor-filtered audit URL, both themes and 360/390/768/1024/1440px without page overflow. Photo storage/provider and the real Auth/profile persistence chain were not changed or production-tested; the preview deliberately disables uploads.

## Release boundary

All four batches retain existing routes, role/verification/configuration guards and service-layer ownership. This is a UI redesign, not the remaining durable DSR audit migration. The isolated preview uses explicitly fictional records and mock services outside the repository; it cannot prove production account writes or Firebase persistence. Coordinate the previously documented Worker/Hosting/rules rollout and authenticated smoke separately.
