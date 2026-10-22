# Hospital / Blood Bank screens

Role **02 — Hospital / Blood Bank** (see `ROLES` in
`web/src/services/users.js`). There is no self sign-up for facilities (D20):
a hospital account is created by the Dugo+ team from a request on
`/partner` (D21) and acts on behalf of its blood bank.

No screens are built yet. The role's intended surface, and the collections each
screen reads or writes (`docs/firestore_schema.md` §2):

- **Requests** — raise and track blood requests for the facility.
  `bloodRequests` (§2.4) scoped to the account's `hospitalId`; the matches it
  produces are `donorMatches` (§2.5).
- **Inventory** — stock levels per blood component, expiry, and transfers.
  `hospitals/{hospitalId}/inventory/{bloodType}` (§2.3.2), with every change
  logged to the `logs` subcollection (§2.3.3) in the same transaction.
- **Dashboard and profile** — `hospitals/{hospitalId}` (§2.3) and
  `hospitals/{hospitalId}/subscriptions` (§2.3.1).

Hospital-facing screens will reuse the same components as the admin area.
`/admin/blood-requests` and `/admin/inventory` are routed but render the shell
only, and the hospital view is the same data scoped to the facility rather than
the global admin view. `services/requests.js` is display-shaped fixture data, not
the `bloodRequests` shape — the schema is.

When one is built, drop it here as a `PascalCase.jsx` page and wire its route in
`web/src/App.jsx`, gating it with `layout/RequireAuth.jsx` when it needs a
session.

Design ground truth for the look is `light/` and `dark/`; there are no
`hospital-*.html` mockups yet, so a new screen composes the component library
(`web/src/components`, see `Gallery.jsx` and `CONVENTIONS.md`) rather than
translating markup. The data ground truth is `docs/firestore_schema.md`.
