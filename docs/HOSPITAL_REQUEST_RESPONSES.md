# Hospital request responses

2026-11-03 · D71 · FR-016, FR-038, NFR-16

At `/hospital/requests`, click the blood/component identity or “View responses”
within a request. The native dialog shows request context, matched donors,
response status, screening status and match time. Response filters cover Accepted,
Declined, Pending and Expired; the default includes every matched donor. Closed
requests retain the same detail entry point. Pages contain up to 25 matches;
Previous/Next traverse an exclusive document-ID cursor, without silent truncation.
Refresh reloads current records. Empty, loading, failure/retry and unavailable
service states are explicit. Escape and Close restore focus to the request button;
the header and page controls remain accessible while scrolling.

## Data access

`services/hospitalResponses.js` calls authenticated
`GET {VITE_MATCHING_ENDPOINT}/hospital/request-responses` with `requestId`, optional
exact `status`, and optional `after` cursor. The existing Worker verifies the
Firebase token. The read handler checks active claims and profile, matching staff
hospital, ownership of the request and an active facility. Administrator access
requires both the admin claim and admin profile.

The request, matches, consents and profiles are read in one Firestore transaction.
Only Accepted matches with a matching deterministic Data Sharing consent whose
`revokedAt` is exactly null return donor contact/profile fields. Removed, suspended,
erased or missing profiles remain private. The allowlist is `fullName`, `email`,
`phoneNumber`, `bloodType` and `city`; date of birth, coordinates, account metadata
and health history are excluded. Declined, Pending, Expired and revoked-consent
matches keep their response visible with a privacy explanation. No donor identities
are copied into new storage. Existing direct staff `users` reads stay denied.
Responses use `Cache-Control: no-store`.

No collections, stored fields, rules or indexes change. The exact response filter
uses the existing `donorMatches.requestId + responseStatus` index.

## Verification

- Production Vite build and `node tools/check-docs.mjs` pass; the compiled assets
  contain the dialog, queue entry point, response endpoint and styles.
- 123 existing matching/account/inventory/export regression tests pass.
- Seven new REST-emulator tests pass using actual Firestore transactions and the
  Worker HTTP route. They cover claims/profile/facility authority, cross-hospital
  rejection, field allowlisting, consent revocation/mismatch/missing records,
  unavailable donor profiles, input errors, closed requests, exact status filters,
  exclusive 25+7 pagination, authentication, CORS and no-store headers.
- Browser verification runs the actual app, Firebase Auth/Firestore emulators and
  the actual Worker handler, using fictional records and blocking external browser
  requests. All four required auth/profile smoke checks pass: verified sign-in to
  `/home`, reload, saved city across reload, and an unverified account held at
  `/verify-email`. `/home` is the existing donor profile route in this build.
- Queue click, contact links, privacy withholding, 25+7 pages, Accepted filtering,
  Escape/focus restoration, Enter reopening, revoked-consent refresh, closed/empty
  request states and error/retry recovery pass.
- Light/dark at 360, 390, 768 and 1440 pixels have no page or dialog horizontal
  overflow. Screenshots were visually inspected. Physical mobile devices and
  production accounts were not used.

The root reference mockups and shared `styles/` are unchanged. An attempted
`python3 tools/screenshots.py` run could not start because that Python environment
lacks Pillow (and the available Python runtime lacks Playwright). Feature-specific
browser screenshots and results are in `/private/tmp/dugo-responders-edit/`.

## Rollout

Deploy the updated Worker before serving this frontend in production. Keep
`VITE_MATCHING_ENDPOINT` pointed at that Worker and retain the existing staff
claims and deployed request/match indexes. An older Worker returns a clear
service-update message. No deployment is performed in this task; production
consent/access smoke remains pending. No product question is open for this scope.
