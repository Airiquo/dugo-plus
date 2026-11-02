# Later donor discovery (D51)

An open request continues discovering eligible donors who register or complete
their profiles after it was posted. The Worker's existing one-minute schedule
rescans the current radius. Expansion still follows the configured wait times;
rescans do not restart those timers. After the maximum radius is reached, the
request continues searching that radius until it leaves `urgent`/`collecting`.

The queue pages through open requests and takes the 20 least recently searched,
then processes that batch in urgency order. With more than 20 open requests,
each request may wait multiple scheduled cycles. This increases Firestore
reads compared with stopping at the final radius tier. The three-second
performance requirements remain open; this is scheduled eventual discovery.

Age, blood compatibility, component deferral, account status and geolocation
checks still apply. A newly registered donor without a saved date of birth or
searchable location does not qualify yet. Matching does not depend on city
spelling. Fulfilled, cancelled and matched requests do not recruit more donors.

Existing matches are excluded before writes, and deterministic match/alert IDs
remain in use. Rescans preserve accepted/declined responses and alert read state.
New matches use the existing notification/email delivery path. The donor UI's
existing live subscriptions display newly created matches and alerts.

## Verification (2026-11-02)

- `npm run test:matching:emulator`: five checks pass against isolated
  `demo-dugo-matching` Firestore REST data: later registration before expansion
  is due, repeat/response/read-state preservation and eventual expansion,
  completed-ladder discovery, profile completion, closed statuses, and rotation
  past the first 20 requests.
- `npm run test:matching`: 88 regression tests pass.
- `cd web && npx vite build`: passes; existing large-bundle warning remains.
- `node tools/check-docs.mjs`: passes (78 rows, 12 features, 51 decisions).
- `npm run worker:check`: passes with cached Wrangler 4.152.0 (the lockfile
  version); the root install does not currently expose a Wrangler executable.
  The emitted `worker/.wrangler/tmp/index.js` includes current/max-radius
  rescans and the paginated queue. No deployment was performed.
- `git diff --check`: passes.

No Firebase SDK service, auth, security-rule, UI or credential changes are
included. The profile sign-in/reload/save/verification smoke was not rerun;
the changed server matching path is covered by the REST-emulator checks.
Production accounts, request statuses and notifications were not modified.
Production Worker deployment and a live end-to-end notification smoke remain
pending. No Hosting/rules/index deployment or data migration is required.
