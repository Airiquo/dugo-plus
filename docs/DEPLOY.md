# Deploy to Firebase Hosting

The app is a Vite SPA served from Firebase Hosting, against the `dugo-plus`
Firebase project. Hosting ships the built frontend only; Firestore rules are a
separate, deliberate step.

## How it is wired

- `firebase.json` declares one hosting site whose `public` is **`web/dist`**, the
  directory Vite's `outDir` targets. There is no `site` field, so the default
  site `dugo-plus.web.app` is used.
- A catch-all rewrite sends every path to `/index.html`, so deep links like
  `/donor/profile` and `/admin/dashboard` survive a refresh instead of 404ing.
- `tools/deploy.sh` builds and then deploys, because `firebase deploy` uploads
  `web/dist` exactly as it finds it and never builds it itself.

## One-time setup

```bash
npm install -g firebase-tools   # the CLI lives outside the repo
firebase login
firebase use dugo-plus          # writes .firebaserc
```

Then, in the Firebase console:

1. **Build → Hosting** — confirm a site exists. The default is
   `dugo-plus.web.app`.
2. **Authentication → Settings → Authorized domains** — `dugo-plus.web.app` must
   be listed. Sign-in fails with `auth/unauthorized-domain` without it, and the
   deploy itself gives no hint that anything is wrong.

## Deploying

**Active temporary direction (D37, 2026-11-01): deploy from clean integration after its protected PR/checks, per the owner.** The main/prod promotion path is temporarily superseded; do not advance those branches for this release. Pass `--project dugo-plus` explicitly if this worktree has no local Firebase alias.

```bash
./tools/deploy.sh
```

That runs `npm run build` in `web/` and then `firebase deploy --only hosting`.
The script prints the checked-out branch first, because the build comes from
whatever branch is checked out, not from a fixed one.

A failed build stops the script, so the previous build is never shipped in place
of a new one.

### Rules are separate

```bash
firebase deploy --only firestore:rules
```

Hosting and rules are split on purpose: a rules change is a different kind of
change from shipping the frontend, and folding them together would push a rules
edit live on every UI deploy. Check the console's *Firestore → Rules* tab before
running this, so you know what is being replaced.

## Cache policy and source revision

`firebase.json` revalidates HTML and unversioned files with `no-cache`. Its later
`/assets/**` rule uses `public, max-age=31536000, immutable` for fingerprinted Vite
assets. Keep the specific rule after the catch-all. Header matching happens
before SPA rewrites, so `/register` also receives `no-cache`.

Builds require a Git checkout. `web/vite.config.js` embeds the current 12-character
HEAD revision into `<meta name="dugo-build">` and `import.meta.env.VITE_BUILD_SHA`.
New client error records store `build: production:<revision>` (or the development
mode), identifying the source revision without changing the Firestore shape.
Commit changes before the release build; a build made before the commit carries
the earlier revision.

After building/deploying from clean `prod`, run:

```bash
node tools/verify-hosting-build.mjs https://dugo-plus.web.app
```

This asserts the HTML stamp matches HEAD, the bundle includes the same log stamp,
`/` and `/register` have `no-cache`, the entry JS is immutable, and the deployed
HTML/JS SHA-256 hashes match local `web/dist` byte for byte. Without a URL it
checks the local build only. It performs no account or database mutation.
A successful deployment check does not establish that a real signup, verification
email, or `users/{uid}` write succeeded; report those checks separately.

References: [Firebase Hosting headers](https://firebase.google.com/docs/hosting/full-config#headers),
[Vite define](https://vite.dev/config/shared-options.html#define).

## Account service (Cloudflare Worker, D38/D39)

The version-2 account service runs at `POST /accounts` in the matching Worker
(`worker/wrangler.toml`). Set `VITE_ACCOUNT_SERVICE_URL` to that Worker URL plus
`/accounts`. The browser requires the v2 capability response before mutation;
there is no browser/callable fallback. The Node `workers/account-service/` and
`functions/` implementations are historical references, not v2 alternatives.

Account operations require the existing Firebase service-account/API-key secrets
and a stable `AUDIT_HASH_SECRET`. Publish the first administrator's claim with
`npm run set:claims` using the documented trusted operator credentials. Runtime
requests require both that claim and an Active admin profile.

For D39 rollout: deploy Firestore indexes and wait until ready; deploy/verify
the Worker; build/deploy Hosting from the owner-authorized release branch;
then deploy the tightened Firestore rules. Old browser bundles lose direct
account writes once rules are tightened and must refresh. See
`docs/ADMIN_ACCOUNT_OPERATIONS.md` for recovery states, verification and the
full compatibility contract. Never rotate the HMAC secret without migration.

## Verifying a deploy

1. Open the URL the CLI prints, `https://dugo-plus.web.app`.
2. Sign in with email and password. `auth/unauthorized-domain` means the console
   step above was skipped.
3. Visit `/donor/profile` directly and reload the page. A 404 means the rewrite
   in `firebase.json` is missing.
4. Sign up with a real address. The verification mail arrives regardless of where
   the app is hosted, because the emailed link points at Firebase's own action
   page.

## The matching Worker's service account

The Cloudflare Worker (`worker/wrangler.toml`, deployed with `npm run
worker:deploy`) reaches Firestore with a service-account key, which bypasses
`firestore.rules`. That account needs Firestore data access of its own, or every
call fails with `403 PERMISSION_DENIED / "Missing or insufficient permissions."`:

1. Generate a key: Firebase console → *Project settings → Service accounts →
   Generate new private key*, or the account's *Keys* tab in GCP IAM.
2. Grant it **Cloud Datastore User** (`roles/datastore.user`) in GCP IAM. Newer
   `firebase-adminsdk-*` accounts are created without it.
3. Load the key into the Worker secret. Secrets are write-only — the old value
   cannot be read back:
   `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT -c worker/wrangler.toml < key.json`
   Updating a secret publishes a new Worker deployment.
4. If a key is exposed, delete it in the account's *Keys* tab and repeat with a
   new one.

## Automatic deploys (not set up)

Pushing to the `prod` branch can deploy automatically through GitHub Actions.
That needs three things outside the repository:

1. A service account key: console → *Project settings → Service accounts →
   Generate new private key*. Never commit the file.
2. GitHub → *Settings → Secrets and variables → Actions*:
   `FIREBASE_SERVICE_ACCOUNT` holding that JSON, plus the six `VITE_FIREBASE_*`
   values.
3. A workflow that builds with those values and runs
   `FirebaseExtended/action-hosting-deploy`.

The six `VITE_FIREBASE_*` values are not secrets, but they must be present at
build time: with any missing, every route renders the `NotConfigured` screen
instead of the app.
