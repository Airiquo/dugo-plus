# Fresh Firebase project — 2026-11-04

The owner requests moving the app to `dugo-plus-clean` (project number
`1037220612564`) and explicitly chooses a fresh database and fresh administrator,
`admin@dugo.com`. No old Auth users, profiles, hospitals, requests, donations,
notifications, consent records or audit history are imported. The old project's
records are retained; this task does not delete that project.

## Configuration

- Firestore remains Native mode in `asia-east2`.
- Email/password and Google sign-in are enabled on the destination.
- The existing enforced password policy is copied: at least eight characters,
  uppercase, lowercase and a number. Email enumeration protection is retained.
- The fresh administrator is verified, enabled, has the `admin` custom claim,
  and has an Active `users/{uid}` profile. Its owner-supplied password is never
  committed to the repository.
- Four donation types and their four interval guidelines use the documented seed
  values. `systemConfig/global` uses the five-tier 5/10/15/20/25 km ladder and
  three retries at five-minute intervals, attributed to the new administrator.
  Reading the old project's current reference/settings data returned HTTP 429,
  so these are repository defaults, not a copy of its current settings.
- No demonstration hospital is seeded.
- `.firebaserc` selects `dugo-plus-clean`; `legacy` names `dugo-plus` explicitly.
  Operator scripts default to the clean project and still accept `--project`.
- The six public Firebase values are in gitignored `web/.env.local`. Existing
  Cloudinary, Formspree and Worker endpoint values remain configured.
- Existing Worker code, Brevo secrets and `AUDIT_HASH_SECRET` are retained.
  Only its Firebase service-account/API-key bindings and allowed origins move.
  The destination service account has Auth administration and Datastore User
  access. Its private key is uploaded directly from private temporary storage.
- Both Firebase Hosting projects serve the clean project's frontend, so
  the existing public URL remains usable. Both Hosting domain pairs are allowed
  by Auth and Worker CORS. Existing sessions must sign in again.

## Verification and release

Provisioning and deployment of the unchanged rules/index definitions completed.
The destination started with zero Auth users and no Firestore collections, then
received one administrator and ten documents (including its profile).

Completed checks:

- The unchanged rules compiled and deployed; all 24 composite indexes are READY.
- Fresh admin password sign-in succeeds, and its token names the destination
  project, verified email and `admin` claim. Its Active profile is readable
  through live client security rules. Exactly one Auth account exists.
- Worker `/health` and authenticated `/accounts` capabilities return HTTP 200
  with the clean-project token and the new origin's CORS header. Its existing
  deployed source and all eight bindings were retained. The owner explicitly
  approved transferring the destination credentials to the existing Worker.
- The configured browser reaches `/admin/dashboard` with one Active profile,
  zero hospital profiles, no privacy requests and the seeded matching settings.
- A missing Firebase API key still renders NotConfigured at an admin route.
- `npx vite build`, `node tools/check-docs.mjs`, 133 regression checks and syntax
  checks for the six changed operator scripts pass.
- Both `https://dugo-plus-clean.web.app` and `https://dugo-plus.web.app` serve the
  exact HTML/JS bytes built from clean integration revision `14f2195879af`.
  This is also the revision previously hosted, so no frontend feature code was
  advanced or rolled back. Build SHA and cache-header verification pass on
  both domains using `tools/verify-hosting-build.mjs`.
- Sixteen existing gitignored environment files in local worktrees now use the
  new project's six public Firebase values. Other integrations are preserved.
  Restart any already-running dev servers to pick up their new environment.

No donor/hospital production workflow, Google OAuth consent flow or email
notification delivery test is claimed. No temporary donor/hospital account was
created. General application requirements retain their previous statuses.

The configuration/documentation feature branch targets protected integration;
its PR/check results are recorded by GitHub. The deployed frontend comes from
integration's already-merged release revision above.

Temporary credential files are removed after the Worker switch and
verification. The uploaded service-account key remains active because the Worker
requires it; deleting its local file does not revoke the deployed credential.
