# Hospital / Blood Bank screens

Role **02 — Hospital / Blood Bank** (see `ROLES` in
`web/src/services/users.js`). There is no self sign-up for facilities (D20):
a hospital account is created by the Dugo+ team from a request on
`/partner` (D21) and acts on behalf of its blood bank.

Built:

- **Requests** (F3) — `/hospital/requests` lists the facility's `bloodRequests`
  (§2.4), urgency first (FR-037), with status filters; `/hospital/requests/new`
  posts one (FR-011, FR-017) and hands its id to the F7 matching Worker. Both
  render `layout/HospitalShell.jsx`.
- **Dashboard** (F6) — `/hospital/dashboard`. The account's landing and the initial
  hospital layout: admin-style shell, facility welcome greeting, and blood collection
  analytics panels (FR-014).
- **Facility profile** (F6) — `/hospital/profile` (FR-013). Edits the facility's
  name, address and contact number through `services/hospitals.js`; the
  Location section preview links to the map. Status is read-only (an
  administrator action).
- **Hospital map** (F6) — `/hospital/map` (FR-015). Leaflet + OpenStreetMap, bounded
  to the Philippines. Shows the saved pin with GPS recentre and relocation confirmation.
- **Inventory & Log** (F6) — `/hospital/inventory` and `/hospital/inventory-log` (FR-020).
  Live stock levels, donation logs, and stock movement logs.
- **Partnership plan** (F6) — `/hospital/plan` (FR-018, D28). Allows hospital staff
  to review current partnership tier, select or upgrade tiers, and view
  subscription history on `hospitals/{hospitalId}/subscriptions` (§2.3.1).

All use `layout/HospitalShell.jsx` and sit behind `RequireRole(['hospital'])`
in `web/src/App.jsx`.
