# Hospital workspace

- `/hospital/dashboard`: collection summaries over the full selected period.
- `/hospital/requests`: facility requests, status filters and accessible sorting.
- `/hospital/inventory` and `/hospital/inventory-log`: screening, stock and movement history.
- `/hospital/profile`: personal staff account and picture, with saved facility context.
- `/hospital/facility`: facility name and contact number; address is read-only.
- `/hospital/map`: administrator-managed location, read-only for staff.

Partnership plan management is removed at the owner’s request. Stock and donation
mutations are served by the authenticated Cloudflare Worker; there is no browser
write fallback. See `docs/HOSPITAL_WORKER_RECONCILIATION.md` for rollout and verification.
