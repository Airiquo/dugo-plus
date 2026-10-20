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

## Verifying a deploy

1. Open the URL the CLI prints, `https://dugo-plus.web.app`.
2. Sign in with email and password. `auth/unauthorized-domain` means the console
   step above was skipped.
3. Visit `/donor/profile` directly and reload the page. A 404 means the rewrite
   in `firebase.json` is missing.
4. Sign up with a real address. The verification mail arrives regardless of where
   the app is hosted, because the emailed link points at Firebase's own action
   page.

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
