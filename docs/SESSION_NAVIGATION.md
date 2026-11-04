# Session history and action confirmations

Owner-approved behavior, 2026-11-04 (D86–D88). Requirement statuses and phase
counts stay unchanged; this is frontend hardening of existing workflows.

## Browser history

While signed in, browser Back/Forward opens **Log out of Dugo+?** without
rendering the historical destination. **Stay signed in**, Close and Escape
retain the current route, account and unsaved input. **Log out** signs out and
replaces the current entry with `/login`; it never proceeds to the old route.
Failures keep the account signed in and offer retry.

`SessionNavigationGuard` uses React Router's data-router `useBlocker`; main's
router now hosts the existing route tree through `RouterProvider`. A same-page
history entry is added once per signed-in account/page load so ordinary Back
from a direct URL or reload stays inside the app. This guards in-app history;
it does not intercept address-bar changes, tab closure or navigation to an
external document selected from the browser's history menu.

`RequireRole` still prevents rendering the other role's children. A wrong-role
URL is replaced with the current account's home rather than an account-type
error page. Authentication, email verification, suspension, Firestore rules
and server authorization remain separate gates.

## Confirm and Back

`ConfirmationProvider` supplies the shared native dialog via `useConfirmation`.
Back, Close and Escape resolve false and preserve the source form. Confirm
resolves true; optional actions have busy/error/retry states. A second request
cannot replace an unanswered review, and route/account changes cancel an
unanswered review. Logout already confirmed by browser history skips a second
prompt. Logout cancellation in the current account menu also cancels its pending redirect.

| Action | Review |
| --- | --- |
| Logout from every existing entry point | Shared Confirm log out / Back, with retry |
| Post a blood request | Blood group, component, units, urgency and notification effect |
| Create a hospital account | Facility and sign-in email |
| Record screening/progress/deferral/completion | Stage and donor; completion includes actual units, stock/history effect |
| Issue or adjust stock | Direction, actual units, group/component and stock-history effect |
| Submit a privacy request | Request type and submitted details remain available behind review |
| Apply privacy correction or close as Completed/Rejected | Changed fields or immutable closure |
| Remove a photo | Initials replace the saved picture |
| Donor acceptance/withdrawal, terminal request statuses, suspend/remove/delete access, erasure, bulk donation completion | Existing review and cancel/back steps retained |

Navigation, filters, ordinary profile/settings/photo saves and read-only views
stay immediate. Existing transaction payloads and backend permissions are
unchanged. Form validation runs before confirmation where the form already
validates inputs; the server remains authoritative.

## Mobile staff navigation

Only `.staff-bottom-nav` hides its destination labels in the existing compact
breakpoint (up to 1024px). Every link and More button has an explicit accessible
name, an icon and its existing current/expanded state. Tap targets remain at
least 44px tall. Desktop sidebars, the full More picker and donor navigation
retain visible labels. Styling uses existing theme tokens.

## Verification

- `npm --prefix web run build` and `node tools/check-docs.mjs` pass.
- Compiled JS contains the logout/confirmation controls; compiled CSS contains
  the staff-only icon-label rule. Fixture credentials are absent from `dist`.
- `npm run test:session-navigation` runs the actual main/router/auth provider,
  guards, shells and selected real forms against isolated fictional services.
  It does not access production accounts or perform live Firestore writes.
- Browser regression checks pass: admin logout → donor login; repeated Back;
  multi-entry history jump; unchanged route/identity/draft; Escape; ordinary
  logout cancellation; logout failure and retry; hospital reload/direct-entry
  anchoring; wrong-role direct URL; unverified gate; missing Firebase config;
  no browser JavaScript errors.
- Real request-posting, donation-completion and donor-privacy form checks prove
  Back retains input with zero mutations and Confirm invokes one mutation.
  Other covered actions compile; their live-provider persistence is not claimed.
- Both staff shells pass light/dark checks at 360/390/768/1024/1280px: compact
  labels hidden, accessible names and icons present, targets at least 44px,
  More picker usable, desktop bottom bar hidden, no horizontal overflow.
  Logout dialogs also fit 360/390/768/1280px in both themes.

The runner needs Playwright available to Node. If it is provided by an external
runtime, set `PLAYWRIGHT_MODULE` to its absolute module path. `CHROME_PATH` can
select an installed Chrome executable; otherwise Playwright uses its browser.
Optional `QA_OUTPUT` saves screenshots to an existing directory. Its fixture
services/configuration live only under `tools/session-navigation/`.

Live Firebase/provider smoke and real Android/iOS testing are not claimed.
The owner subsequently authorizes protected integration merge and redeployment
of Hosting and Firestore rules to `dugo-plus-clean`; release output records the
merged revision and hosted-byte/header verification. The reference mockups/shared styles are unchanged. An attempted
`python3 tools/screenshots.py` cannot run in this environment because its Python
Pillow/Playwright dependencies are missing; actual app browser captures above
verify the changed styling.
