# Encryption and Firebase security configuration

**Feature:** F11 · **Requirement:** NFR-10 (with FR-019, NFR-16)
**Status:** in-transit checked against the live site; at-rest is Google's
documented default and is **not console-verified from this checkout**.

This document records the encryption position and the security configuration of
the Dugo+ Firebase project, separating what was observed from what is assumed.
No additional key management has been enabled, and this document does not claim
otherwise.

## 1. In transit — checked

`https://dugo-plus.web.app` was requested on **2026-11-01**. The response
included:

```
Strict-Transport-Security: max-age=31556926; includeSubDomains; preload
```

`max-age=31556926` is one year. That header makes browsers refuse a plain-HTTP
downgrade for the site, its subdomains and (via `preload`) the preload list, and
Firebase Hosting serves the site over HTTPS by default (`firebase.json` →
`hosting.public: "web/dist"`, with an SPA rewrite to `index.html`). The Firebase
SDK calls to Firestore and Authentication go to Google APIs over TLS; that is
Google's documented transport, not a header this project sets.

No certificate, ciphersuite or TLS-version inspection was performed from here;
that would need a tool like `openssl s_client` or a console review. The single
observed fact is the HSTS header above.

## 2. At rest — Google default, not console-verified

Cloud Firestore and Firebase Authentication encrypt stored data with
**Google-managed keys** at rest by default, on Google's infrastructure. That is
the platform's published default, and it applies to a standard Spark/Blaze
Firebase project. It is **not a project-specific console setting that was
inspected here** — this checkout has no Firebase console access, so the claim is
recorded as the documented default and left for console confirmation under
NFR-10.

Consequences that follow from the default and are worth stating plainly:

- the encryption key is managed by Google, not by Dugo+;
- there is **no field-level or application-level encryption** of health fields
  (`bloodType`, `dateOfBirth`, `lastDonationAt`, screening result);
- there is no customer-managed key (CMMEK) configuration;
- a database export or an operator with console access sees plaintext.

Whether field-level encryption is needed for the health fields is an **open
decision** for the project team; it would change read paths and query ability, so
it is not added speculatively.

## 3. What the app does to keep data out of the wrong places

| Risk | Handling |
| --- | --- |
| Identifiers in URLs | the hospital donor id is passed in router state (`location.state.donorId`), not a path segment, so it does not enter browser history or a server access log |
| Secrets in the client | only `VITE_FIREBASE_*` web config is used; the Firebase web API key is a public project identifier, and access is enforced by rules. No service-account key is in the web app (`web/.env.example`) |
| Data in error messages | `errorLogs` records `message`, `stack`, `route`, `uid`, `build` only, is create-only and has no client read path (D17) |
| Data in the audit chain | `auditBlocks` stores hashed references, not readable personal data (D2) |
| Over-broad reads | access is per-role in `firestore.rules`; hospital donor reads additionally require current consent (D32) |

## 4. Configuration review

| Item | State |
| --- | --- |
| HTTPS / HSTS | on (observed header, 2026-11-01) |
| Firestore at-rest encryption | Google-managed default (documented, not console-verified) |
| Field-level encryption | none |
| Firebase App Check | **not enabled** (no evidence of it in the repo or config) |
| Security rules version | committed rules carry the F11 consent gate; the **live project still enforces the 2026-10-21 ruleset** (PHASES §10) |
| Firestore backups / PITR | not configured from this checkout (NFR-08a/b, open) |

## 5. Gaps and what would close them

1. **Console walkthrough** of Firestore/Auth at-rest encryption settings, with a
   screenshot or export as evidence — closes the at-rest half of NFR-10.
2. **Decision on field-level encryption** for health fields.
3. **Enable App Check** and, if practical, MFA for admin accounts.
4. **Deploy the rules** that carry the consent gate (needs authorization).
5. **Backup/export job** evidence for NFR-08a/b.

Until items 1 and 4 are done, NFR-10 is `partial`: transport is evidenced, at-rest
is the platform default rather than a verified project setting.
