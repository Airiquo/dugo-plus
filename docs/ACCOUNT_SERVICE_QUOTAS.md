# Admin account actions and Firestore quota

## Confirmed incident

On 2026-11-03, account details returned Firestore HTTP 429 / RESOURCE_EXHAUSTED. Other account actions presented the generic unavailable-service message because the capability probe converted 429 to 503 before sending any mutation.

A read-only Cloud Monitoring query made through the existing Firebase CLI login confirmed the exhausted quota for project `dugo-plus`:

- Metric: `serviceruntime.googleapis.com/quota/exceeded`
- Quota metric: `firestore.googleapis.com/read_operations_per_project`
- Limit: `ReadOperationsPerProjectPerDay`
- Positive exceedance samples around 13:12 and 13:46–13:52 Manila on Nov 3.

The owner supplied a Firebase chart with 40K reads, 2K writes and two deletes for Nov 2 14:00–Nov 3 13:00 Manila. That chart explicitly excludes some operations and may differ from quota accounting. The Monitoring limit label establishes daily read exhaustion; the chart alone did not.

## Recovery

Hosting redeploys and browser reloads do not reset Firestore quota. Firebase documents a free daily allowance of 50,000 reads and 20,000 writes, reset around midnight Pacific. On Nov 3, 2026 that is approximately 16:00 Manila. Recovery timing is approximate and must be checked by a subsequent legitimate read. Enabling billing is an owner decision with spending implications; this change does not modify billing, quotas or schedules.

Avoid repeated account submissions while the database rejects reads. An operation may already have progressed before a failure. After recovery, retry with the same details so the existing operation ID can reconcile progress; do not infer that nothing changed from an error alone.

## Client correction

- Capability HTTP 429 keeps its status and reports quota guidance. No mutation is sent after a failed capability probe.
- Profile reads and account mutations map resource exhaustion to the same message instead of raw Firestore response text or an undeployed-server suggestion.
- Existing unfinished-operation IDs remain available after 429 and are reused on manual retry. No automatic retry, role bypass, direct browser-write fallback, Worker change or rule change is introduced.

## Recurring-read investigation

`worker/wrangler.toml` invokes the Worker every minute. `runMatchingCycle` reads all active requests in pages and searches up to 20, including requests at their maximum radius. Searches read config, donation type, geohash donor queries and existing matches. Recovery, audit delivery/redaction and notification retries also run on the schedule. Admin list views and donor listeners add separate usage.

These are candidates for measured optimization, not proof of attribution. Preserve D51's behavior for newly eligible donors and account/audit recovery when reducing reads. Cache only non-security reference/configuration data with explicit freshness; do not cache active-admin authorization checks or drop audit delivery to hide quota failures. A bounded query/due-work design needs its own coverage and Worker rollout. No frequency or schema change is included in this incident patch.

## Verification

Seven account-request tests cover existing retry behavior plus quota failure before a mutation and after a mutation. The latter retains the same operation ID for a later manual retry. An isolated fixture renders the actual Accounts/editor and actual error mapper: Edit details and a failed fictional suspension show quota guidance; the suspension reason stays entered. No production account mutation was attempted.

The four real persistence/auth smoke checks remain blocked by the incident and lack of a designated disposable account. Build, documentation and compiled-message checks run before commit; protected PR CI remains required.

References: [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [quota Monitoring metrics](https://docs.cloud.google.com/monitoring/alerts/using-quota-metrics).
