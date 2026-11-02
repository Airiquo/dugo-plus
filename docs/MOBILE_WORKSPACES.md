# Responsive donor, hospital and admin workspaces

D61 refines existing built screens. It does not implement the unbuilt hospital dashboard, inventory or screening workflows.

## Composition and reuse

- `WorkspaceNav` owns the shared route/active-state link rendering, including the donor unread badge. `RoleShell` provides shared admin/hospital chrome; existing AppShell and HospitalShell remain their public wrappers. The donor retains its existing page composition.
- At 1024px and below, staff navigation uses a compact header and safe-area bottom dock. Admin exposes Overview, Accounts, Activity and a native More dialog containing all six built destinations. Hospital exposes Requests, New request and My profile. Donor also uses its bottom dock through tablet widths so profile/session controls remain on screen.
- The navigation sheet supports Escape, native focus containment, trigger-focus restoration, body scroll locking and close-on-navigation/desktop resize. Its IDs derive from `name`.
- Admin Profile collapses its identity rail before the contact form becomes cramped (1279px). Both staff profiles reuse ProfileAvatar and ProfilePhotoEditor; photo editing is a disclosure rather than a dominant upload area.
- Audit Trail and Data Requests opt into Table's labeled, single-DOM phone cards. Cells retain row/cell roles; mobile sorting controls replace hidden header controls. Existing Accounts actions form a two-column touch grid. No duplicated action instances are introduced.
- Mobile form text is 16px, primary controls are at least 44px, dialogs use dynamic viewport bounds, and bottom padding accounts for the docks and safe areas. Short landscape viewports use horizontal compact dock items. Settings tier labels span their own row through 760px so both inputs keep usable widths. Shared base styles remain unchanged; deliberate app overrides use existing theme tokens.
- Route navigation returns donor/staff pages to the top. Existing route slugs, configuration/auth/role/verification gates, data services, validation, sorting scopes and mutations remain unchanged.

## Verification

An isolated local harness imports the actual pages/components/styles and replaces services with fictional fixtures outside the repository. It performs no production account operations.

- 85 light-mode route/width checks: six admin screens, three hospital screens, five donor screens and login/register/partner, each at 320, 390, 768, 1024 and 1280px. No document overflow, missing main heading or clipped navigation controls. Landing additionally checked at 320px.
- 30 dark-mode checks: ten representative donor/hospital/admin routes at 360, 768 and 1440px; no document overflow. Visual inspection covers the compact profile, desktop rail, hospital queue and labeled privacy-request cards.
- Admin navigation sheet opens with close-button focus; Escape closes it and restores More focus/scroll. Hospital creation overlay fits a 390x844 viewport with internally scrollable content and 16px fields. Settings checked at 844x390 landscape with its existing sticky save controls and compact bottom dock.
- Audit phone sorting by Occurred changes the first record from #104 ascending to #128 descending; View opens the corresponding suspension detail dialog. Existing ordering scopes remain unchanged.
- Admin Profile failed save retains the draft and Discard restores it; failed load disables editing and Try again recovers. Hospital empty queue and missing-field request validation remain usable.
- Build, traceability, compiled-output and CI results are recorded with the feature PR. No backend, rules or Worker change is needed.

Real Android/iOS keyboards, screen readers, physical-device safe areas, authenticated production persistence, and a complete cross-browser matrix remain pending. Browser viewport checks do not establish those outcomes.
