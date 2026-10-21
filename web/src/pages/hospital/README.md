# Hospital / Blood Bank screens

Role **02 — Hospital / Blood Bank** (see `ROLES` in
`web/src/services/users.js`). There is no self sign-up for facilities (D20):
a hospital account is created by the Dugo+ team from a request on
`/partner` (D21) and acts on behalf of its blood bank.

No screens are built yet. The role's intended surface:

- **Requests** — raise and track blood requests for the facility.
- **Inventory** — stock levels per blood component, expiry, and transfers.

Related admin screens already exist and render from the shared data layer:
`/admin/blood-requests` (`pages/admin/BloodRequests.jsx`, backed by
`services/requests.js`) and the inventory stub (`/admin/inventory`). A
hospital-facing screen typically reuses those same components with a facility
scope rather than the global admin view.

When one is built, drop it here as a `PascalCase.jsx` page and wire its route in
`web/src/App.jsx`, gating it with `layout/RequireAuth.jsx` when it needs a
session.

Design ground truth lives in `light/` and `dark/`; there are no `hospital-*.html`
mockups yet, so a new screen composes the component library
(`web/src/components`, see `Gallery.jsx` and `CONVENTIONS.md`) rather than
translating markup.
