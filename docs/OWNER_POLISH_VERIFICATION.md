# Owner-requested polish, 2026-11-04

Continue the settings/layout work at `0db771d` on integration-based feature
branches. Ratings/review content stay unchanged. The owner withdraws the
inventory-refresh fix because inventory works; no inventory write change is
included. Registration requires date of birth, gender and blood type.

## Landing (D86)

Global pause/theme controls restored. Cards have local pause/hover controls.
The request-to-donation steps are click-driven, with no scroll handler; perspective
copy/checks animate on change. Partners precede impact and platform. Ribbon
positions are fractional, retained in memory by name across remounts, and remeasured
on resize; arrows continue from the current offset. No rating/review copy changes.

Vite production build passes. Chrome fixtures pass at 390/1440px in both themes: global pause, click-driven steps, ribbon offset retention and no page overflow. Reference screenshot regeneration was attempted; Pillow is unavailable.
No phase counts change; broader usability/device acceptance stays open.

## Navigation (D87)

My profile is separate from Settings for donors/hospitals. Settings contains
Appearance and Privacy/Facility details respectively; visited panels retain drafts.
Legacy privacy/facility URLs redirect into the selected tab. Existing hospital
donor-directory route is retained. Sign out is separated by a divider and danger
text in shared account menus and donor profile actions. Admin navigation stays.

## Route loading and caching (D88)

Route chunks are present in dist. Hover/focus preloads code, never data.
Profiles/facilities/stock use a 30-second memory cache with concurrent-read
deduplication; stock listeners are shared and released on last unsubscribe.
Writes invalidate relevant reads. Session changes/sign-out clear data/listeners.
An aborted consumer receives AbortError without cancelling a shared reader.
Firestore's getDoc/getDocs API cannot abort the underlying transport. No profile
or health data is added to browser storage. Cache regressions pass (3 tests).
Configured live sign-in/save/reload/verification smoke remains to be run with
local emulator credentials; fixture checks are recorded separately.
