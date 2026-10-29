# Account service (free host)

Creating or deleting a Firebase Auth account and publishing a custom claim need
the Admin SDK. `functions/index.js` does that as Cloud Functions, which need the
Blaze plan. This folder does the **same work on a free host** (Vercel or
Netlify), so `/admin/accounts` can create a hospital account without Blaze and
without running a script by hand.

It mirrors `functions/index.js` and is kept in step with it by hand.

## What it exposes

One endpoint, `POST /api/account`, with a JSON body and a Firebase ID token:

| Action | Auth | Body | Does |
| --- | --- | --- | --- |
| `createHospitalAccount` | admin | fields from the admin form | Auth user + `users/{uid}` + `hospitals/{id}` + `staff` claim |
| `deleteAuthAccount` | admin | `{ uid }` | deletes one sign-in record |
| `setClaims` | admin | `{ uid? }` (omitted = all) | publishes claims from `users/{uid}` |
| `bootstrap` | `BOOTSTRAP_TOKEN` | `{ email, token }` | grants the first admin its claim |

`GET /api/account` serves a one-time page for the `bootstrap` step.

## Deploy (Vercel)

1. **Service-account key.** Firebase console → *Project settings → Service
   accounts → Generate new private key*. Keep the file outside the repo.
2. **New Vercel project** (Hobby plan is free and needs no card). Import this
   repository and set **Root Directory** to `workers/account-service`. Leave the
   framework preset as *Other*.
3. **Environment variables** (Project → Settings → Environment Variables):
   - `FIREBASE_SERVICE_ACCOUNT` — the whole JSON file's contents, one line.
   - `ALLOWED_ORIGINS` — e.g. `https://dugo-plus.web.app,http://localhost:5173`.
     Defaults to `*` when unset.
   - `BOOTSTRAP_TOKEN` — any long random string. Remove it after step 5.
4. **Deploy**, then note the URL, e.g. `https://dugo-plus-account.vercel.app`.
5. **Grant your admin its claim.** Open
   `https://dugo-plus-account.vercel.app/api/account` in a browser, enter your
   admin sign-in email and the bootstrap token, and submit. This writes
   `users/{uid}.role = 'admin'` and the matching custom claim — the one step
   `scripts/set-claims.mjs` would otherwise do.
6. **Point the app at it.** In `web/.env.local`:

   ```
   VITE_ACCOUNT_SERVICE_URL=https://dugo-plus-account.vercel.app/api/account
   ```

   Sign out and back in, then create a hospital from `/admin/accounts`.
7. **Remove `BOOTSTRAP_TOKEN`** from the host's environment and redeploy. The
   page then reports the action is disabled.

## Netlify instead

Same code, one thin adapter: Netlify handlers receive `(event, context)` and
return `{ statusCode, headers, body }`. Map `event.httpMethod`/`event.headers`/
`event.body` into `handle()` from `lib/service.js` and return its result.

## Notes

- The browser never holds the service key; it sends only its own ID token, and
  the service checks the `role: 'admin'` claim before doing anything.
- `firebase-admin` runs as-is on a Node host (Vercel/Netlify). It does **not**
  run on Cloudflare Workers or Deno Deploy — those would need the Google REST
  APIs instead.
- Vercel's Hobby plan is for personal, non-commercial use. For a commercial
  launch, use a paid plan, Cloud Run, or Cloud Functions on Blaze.
