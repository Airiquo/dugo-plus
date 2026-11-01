# Health information handling (DOH AO 2020-0030)

**Feature:** F11 · **Requirements:** NFR-18, NFR-17, NFR-16
**Reference:** Department of Health Administrative Order No. 2020-0030,
*Data Privacy Guidelines on the Processing of Health Information*

This document maps Dugo+ onto the DOH guidelines. It separates **implemented
technical safeguards** from **organisational and legal items that still need a
human**. It is not a claim of certified compliance.

## 1. The health information Dugo+ holds

| Field | Where | Sensitivity |
| --- | --- | --- |
| Blood type | `users/{uid}` | health-related |
| Date of birth | `users/{uid}` | health-related (eligibility/age rules) |
| Last donation date | `users/{uid}` | health-related |
| Screening result (`Cleared \| Deferred \| Rejected`) | `donorMatches` | health-related |
| Donation records | `donations`, `rewardTransactions` | health-related / traceability |

Contact, identity and location data are personal data; when combined with the
fields above for matching, the processing is health-related and the guidelines
apply.

## 2. How the guidelines are addressed

| Guideline area (AO 2020-0030) | What Dugo+ does | Evidence |
| --- | --- | --- |
| V(c)–V(d): lawful basis and **consent** for processing health information | A separate, explicit hospital-access consent at `donorConsents/{uid}`, with the purpose stated; registration acceptance is not used as a substitute. | `web/src/pages/donor/Consent.jsx`, `docs/CONSENT_AND_WITHDRAWAL.md`, `firestore.rules` |
| VI(a)(2)–(4): **purpose** stated, **data minimisation** and proportionality | The consent screen lists six categories and the reason for each; the hospital read exposes those fields only; there is no donor directory. | `web/src/utils/consent.js`, `web/src/pages/hospital/DonorProfile.jsx` |
| VI(b): **limited access** and confidentiality | Read access is role- and consent-gated in `firestore.rules`; staff cannot list `users` or read the consent record; admins cannot grant consent. | `firestore.rules`, `firestore.rules.test.mjs` |
| VII(b)(15): national blood-service / blood-safety context | Donation records are retained de-identified for traceability and are not deleted by a consent withdrawal. | `docs/DATA_RETENTION_AND_DISPOSAL.md` |
| VIII: penalties / accountability | Consent records and the audit chain are retained as evidence; error events are recorded. | `donorConsents`, `auditBlocks`, `errorLogs` |
| Security of health information | HTTPS in transit, Google-managed at-rest encryption, server-enforced rules. | `docs/ENCRYPTION_AND_FIREBASE_SECURITY.md` |

## 3. Handling rules the build follows

- **Least data**: the hospital screen shows only the consented categories.
- **No re-identification in the open**: the hospital donor id travels in router
  state, not the URL, so it does not land in history or access logs.
- **Withdrawal is respected immediately**: the rules re-read the consent record
  on every hospital `get`.
- **No client trust for the gate**: hiding UI is not the control; the ruleset is.
- **De-identified retention**: erasure scrubs identifiers while donation rows
  keep their own record ids for blood safety.

## 4. Organisational and legal items still open

These cannot be completed from application code and are **not** claimed as done:

1. **Data Protection Officer** — not named.
2. **Privacy impact assessment** for the health-related processing — not done.
3. **Breach-notification procedure** with an owner, timelines and the NPC
   reporting path — drafted at a high level only (see
   `docs/SECURITY_AND_INCIDENT_HANDLING.md`).
4. **Retention schedule approval** — `docs/DATA_RETENTION_AND_DISPOSAL.md` is a
   policy, with no automated disposal job.
5. **Legal review** of the consent and notice wording.
6. **Deployment of the rules** carrying the gate, and a live smoke run.

## 5. Incident handling for health information

An actual or suspected unauthorised access to health information follows
`docs/SECURITY_AND_INCIDENT_HANDLING.md`. The design assumption is that the
consent gate makes a mass donor read impossible from a hospital account, so the
realistic incidents are credential compromise, misconfiguration and operator
misuse.
