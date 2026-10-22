# Donor screens

Role **01 — Donor** (see `ROLES` in `web/src/services/users.js`).
A donor signs up from the landing page (`/register` — self-registration is
donor-only, D20) and manages their own relationship with a facility.

No screens are built yet except **Profile**. The role's intended surface, and the
collections each screen reads or writes (`docs/firestore_schema.md` §2):

- **Profile** — blood type, date of birth, eligibility, contact details.
  Built as `Profile.jsx` (FR-04); reads/writes `users/{uid}` (§2.1 — the built
  shape, D16). The donor lands here after sign-in.
- **Alerts** — urgent blood-type match notifications and request updates.
  `notifications` (§2.8), plus their `donorMatches` (§2.5) and `bloodRequests`
  (§2.4) rows.
- **History** — past donations and the facilities they were at.
  `donations` (§2.9, doc ID = match ID) joined to `donorMatches` (§2.5).
- **Rewards** — points, tiers, and redeemable perks for repeat donations.
  `rewardTransactions` (§2.10) — one row per donation, summed on read (D12).

When one is built, drop it here as a `PascalCase.jsx` page and wire its route in
`web/src/App.jsx`. Donor screens are not gated behind the admin shell by
default — reuse `layout/RequireAuth.jsx` if a screen needs a session.

Design ground truth for the look is `light/` and `dark/`; there are no
`donor-*.html` mockups yet, so a new screen composes the component library
(`web/src/components`, see `Gallery.jsx` and `CONVENTIONS.md`) rather than
translating markup. The data ground truth is `docs/firestore_schema.md` — read
the collection before designing fields.
