# F4, F5 and map integration — 2026-11-02

Branch: `feat/f4-f5-map-integration`, based on `origin/integration` at `a9f90bb`.
F4 (`b7298dd`) is already in integration. F5 (`508edc0`) adds donor activity,
history, points and component-aware tracking. The map fixes are `origin/fix/f4_map`.

Conflict resolutions preserve the current auth gates, `/home` redirect, account
operations, profile pictures and care styling. Activity uses shared donor navigation.
Both hospital service exports remain available. Existing whole-blood eligibility
callers retain their 56-day default; history/profile explicitly pass an unknown
component to use F5's 112-day fallback. F5 reward scope is D41 (D26 already exists).

Validation results will be recorded after the combined branch is checked.
Signed-in production smoke requires test-account credentials; no live data or
provider configuration is changed by this integration. The imported demo seeder
is available as `npm run seed:demo` but is not run against production.
