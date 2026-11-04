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
