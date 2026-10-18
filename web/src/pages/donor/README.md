# Donor screens

Role **01 — Donor** (see `AUTH_ROLES` in `web/src/layout/AuthLayout.jsx`).
A donor signs up from the landing page (`/register?role=donor`) and manages
their own relationship with a facility.

No screens are built yet. The role's intended surface, per the register band:

- **Profile** — donation history, blood type, eligibility, contact details.
- **Alerts** — urgent blood-type match notifications and request updates.
- **Rewards** — points, tiers, and redeemable perks for repeat donations.

When one is built, drop it here as a `PascalCase.jsx` page and wire its route in
`web/src/App.jsx`. Donor screens are not gated behind the admin shell by
default — reuse `layout/RequireAuth.jsx` if a screen needs a session.

Design ground truth lives in `light/` and `dark/`; there are no `donor-*.html`
mockups yet, so a new screen composes the component library
(`web/src/components`, see `Gallery.jsx` and `CONVENTIONS.md`) rather than
translating markup.
