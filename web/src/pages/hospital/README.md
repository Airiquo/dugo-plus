# Hospital workspace

- `/hospital/dashboard`: active request priorities and collection summaries over the full selected period.
- `/hospital/requests`: facility requests, status filters and accessible sorting.
- `/hospital/inventory` and `/hospital/inventory-log`: component/group stock cards and movement history. `?view=screening` opens donor screening and reviewed collection confirmation.
- `/hospital/profile`: personal staff account and picture, with saved facility context.
- `/hospital/facility`: facility name and contact number; address is read-only.
- `/hospital/map`: administrator-managed location, read-only for staff.

Partnership plan management is removed at the owner’s request. Stock and donation
mutations are served by the authenticated Cloudflare Worker; there is no browser
write fallback. See `docs/HOSPITAL_WORKER_RECONCILIATION.md` for rollout and verification.

Design, interaction details and current verification: `docs/HOSPITAL_EXPERIENCE.md`.

Donation calendars, charts, stock quantity colors, complete date filters and KPI shortcuts: `docs/RECORD_FILTERS_AND_ANALYTICS.md`.
