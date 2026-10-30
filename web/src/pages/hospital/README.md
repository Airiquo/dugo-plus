# Hospital / Blood Bank screens

Role **02 — Hospital / Blood Bank** (see `ROLES` in
`web/src/services/users.js`). There is no self sign-up for facilities (D20):
a hospital account is created by the Dugo+ team from a request on
`/partner` (D21) and acts on behalf of its blood bank.

Built:

- **Dashboard** — `/hospital/dashboard`. The account's landing and the initial
  hospital layout: admin-style shell, facility summary from
  `hospitals/{hospitalId}` (§2.3), and the link to the profile. Analytics and
  inventory panels belong to the rest of F6.
- **Facility profile** — `/hospital/profile` (FR-013). Edits the facility's
  name, address and contact number through `services/hospitals.js`; the
  Location section preview links to the map. Status is read-only (an
  administrator action). The account's facility comes from
  `users/{uid}.hospitalId`; the hospital claim is `role: 'hospital'` with that
  `hospitalId`.
- **Hospital map** — `/hospital/map` (FR-015). Leaflet + OpenStreetMap, bounded
  to the Philippines. Shows the saved pin. A floating GPS control recentres on
  the device location and marks it with a blue dot. Relocate mode accepts a
  candidate point from a map click or device geolocation, then asks for
  confirmation before saving coordinates plus a derived geohash.

All three use `layout/HospitalShell.jsx` and sit behind `RequireRole(['hospital'])`
in `web/src/App.jsx`.

The role's intended surface, and the collections each screen reads or writes
(`docs/firestore_schema.md` §2):

- **Requests** — raise and track blood requests for the facility.
  `bloodRequests` (§2.4) scoped to the account's `hospitalId`; the matches it
  produces are `donorMatches` (§2.5).
- **Inventory** — stock levels per blood component, expiry, and transfers.
  `hospitals/{hospitalId}/inventory/{bloodType}` (§2.3.2), with every change
  logged to the `logs` subcollection (§2.3.3) in the same transaction.
- **Subscriptions** — `hospitals/{hospitalId}/subscriptions` (§2.3.1).

Hospital-facing screens reuse the same components as the admin area. There are
no `hospital-*.html` mockups: a new screen composes the component library
(`web/src/components`, see `Gallery.jsx` and `CONVENTIONS.md`) rather than
translating markup. The data ground truth is `docs/firestore_schema.md`.
