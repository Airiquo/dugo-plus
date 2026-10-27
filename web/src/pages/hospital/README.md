# Hospital / Blood Bank screens

Role **02 — Hospital / Blood Bank** (see `ROLES` in
`web/src/services/users.js`). There is no self sign-up for facilities (D20):
a hospital account is created by the Dugo+ team from a request on
`/partner` (D21) and acts on behalf of its blood bank.

Built (F3): the **Requests** surface — `/hospital/requests` lists the
facility's `bloodRequests` (§2.4), urgency first (FR-037), with status filters;
`/hospital/requests/new` posts one (FR-011, FR-017) and hands its id to the F7
matching Worker. Both render `layout/HospitalShell.jsx`, the hospital sidebar,
and sit behind `RequireRole(['hospital'])` in `App.jsx`. The account's facility
comes from `users.hospitalId`; `services/requests.js` reads
`hospitals/{hospitalId}` and writes the denormalized name/coordinates onto each
request.

The rest of the role's intended surface, and the collections each screen reads
or writes (`docs/firestore_schema.md` §2):

- **Inventory** — stock levels per blood component, expiry, and transfers.
  `hospitals/{hospitalId}/inventory/{bloodType}` (§2.3.2), with every change
  logged to the `logs` subcollection (§2.3.3) in the same transaction (F6).
- **Dashboard and profile** — `hospitals/{hospitalId}` (§2.3) and
  `hospitals/{hospitalId}/subscriptions` (§2.3.1) (F6).

Moving a request's status (`matched`, `fulfilled`, `cancelled`) needs the staff
custom claim (D15), which is not issued yet; `Requests.jsx` is read-only until it
is.

When one is built, drop it here as a `PascalCase.jsx` page and wire its route in
`web/src/App.jsx`, gating it with `layout/RequireAuth.jsx` when it needs a
session.

Design ground truth for the look is `light/` and `dark/`; there are no
`hospital-*.html` mockups, so a new screen composes the component library
(`web/src/components`, see `Gallery.jsx` and `CONVENTIONS.md`) rather than
translating markup. The data ground truth is `docs/firestore_schema.md`.
