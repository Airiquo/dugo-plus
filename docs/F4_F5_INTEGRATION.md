# F4, F5 and map integration — 2026-11-02

Branch: `feat/f4-f5-map-integration`, based on `origin/integration` at `a9f90bb`.
F4 (`b7298dd`) is already in integration. F5 (`508edc0`) adds donor activity,
history, points and component-aware tracking. The map fixes are `origin/fix/f4_map`.

Conflict resolutions preserve the current auth gates, `/home` redirect, account
operations, profile pictures and care styling. Activity uses shared donor navigation.
Both hospital service exports remain available. Existing whole-blood eligibility
callers retain their 56-day default; history/profile explicitly pass an unknown
component to use F5's 112-day fallback. F5 reward scope is D41 (D26 already exists).

## Verification

- Production Vite build passes; compiled assets contain `/donor/activity`, the
  activity and map styles, and the saved-pin/missing-location map copy. The
  existing large-chunk advisory remains.
- `node tools/check-docs.mjs` passes (78 rows, 12 features, 41 decisions).
- `npm run test:matching`: 67 passed, including coordinate rejection and the
  unknown-component fallback regressions. `npm run test:profile-photos`: 2 passed.
- Firestore emulator rules suite: 207 passed, 0 failed.
- Worker REST transaction emulator suite: 4 passed, 0 failed.
- Actual app with real Firebase SDKs against isolated `demo-dugo` Auth/Firestore
  emulators: sign-in reaches `/home`; saved details survive reload; changing city
  persists across reload; an unverified account stays at `/verify-email`, including
  direct navigation to `/donor/activity`.
- Activity reads two donations, facility names, 200 total points and eligibility.
  Light/dark layouts have no horizontal overflow at 1280, 768, 390 and 360px.
- Map: inaccurate GPS uses the saved pin; accurate GPS uses the live point;
  facility coordinates override stale request 0,0; missing coordinates remain
  listed without a marker; directions use resolved endpoints. Acknowledgment and
  both consents allow acceptance, whose coordinates persist in the emulator.
  Both themes have no horizontal overflow at 1280, 390 and 360px.
- A separate app instance with all Firebase values empty renders NotConfigured
  at `/donor/activity`. The browser smoke reports no uncaught runtime errors.
- Temporary browser service-seam fixtures exercise Activity loading, empty and
  error states; retry then recovers the real emulator donation history.
- Visual proofs and temporary harnesses: `/private/tmp/dugo-f4-f5-qa/`.

Signed-in production smoke requires test-account credentials; no live data or
provider configuration is changed by this integration. The imported demo seeder
is available as `npm run seed:demo` but is not run against production.
