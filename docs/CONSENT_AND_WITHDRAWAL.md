# Consent and withdrawal procedure

**Feature:** F11 · **Requirements:** FR-038 (F11 half), NFR-16, NFR-18
**Donor screen:** `/donor/consent` (`web/src/pages/donor/Consent.jsx`)
**Hospital screen:** `/hospital/donor` (`web/src/pages/hospital/DonorProfile.jsx`)
**Record:** `donorConsents/{uid}` (schema §2.6, D32)

This is the operational procedure for hospital-access consent: what is asked,
where it is stored, and how it is enforced. FR-038 is shared with F4, whose
per-match consent prompt is a separate, still-unbuilt piece; this document covers
the F11 portion.

## 1. What the donor is asked

On `/donor/consent` the donor reads, before deciding:

- **what a hospital may see**, as categories rather than field names: identity
  (name), contact (email and phone), blood type, date of birth, city and
  approximate coordinates, and last donation date;
- **why each category is needed** (matching, compatibility, age and deferral
  rules, proximity, waiting interval);
- that agreeing is optional and can be withdrawn at any time;
- that hospital staff cannot browse a donor directory, and another donor cannot
  read the profile.

The donor ticks a box and records consent. The stored scope keys are `identity`,
`contact`, `bloodType`, `age`, `location`, `donationHistory`.

## 2. What is stored

One document per donor at `donorConsents/{uid}`:

| Field | Value |
| --- | --- |
| `donorId` | the donor's uid (equals the document id) |
| `consentType` | `HospitalProfileAccess` |
| `consentVersion` | the consent-text version, currently `2026-11-01` |
| `scope` | the six category keys, exactly |
| `purpose` | `hospital-donor-matching` |
| `status` | `granted` or `revoked` |
| `grantedAt` | server time of the most recent grant |
| `revokedAt` | server time of a withdrawal, null while granted |
| `revokedReason` | optional donor note (≤500 chars) |
| `recordedBy` | the donor's uid |
| `updatedAt` | server time of the last write |

Registration acceptance (`privacyConsentAt` on `users/{uid}`) is a **separate**
record and is never treated as hospital-access consent.

## 3. Who may do what

| Actor | Allowed | Not allowed |
| --- | --- | --- |
| Donor (owner) | create own record, grant, re-grant, withdraw | write under another uid; change scope, type, version or purpose; delete |
| Admin | read any consent; **revoke only** | grant, edit scope or times, delete |
| Hospital staff | nothing directly | read the consent record; list donors |
| Anyone | — | delete a consent record |

The administrator's revoke path exists so an erasure request closes the hospital
gate before the profile is scrubbed. It is invoked from
`/admin/data-requests` (`revokeConsentOnErasure` in `web/src/services/consents.js`).

## 4. How the gate works

`firestore.rules` defines `hasHospitalConsent(donorId)`, which `get()`s
`donorConsents/{donorId}` and requires:

- `status == 'granted'` and `revokedAt == null`;
- `consentType == 'HospitalProfileAccess'`;
- `consentVersion == '2026-11-01'`;
- `purpose == 'hospital-donor-matching'`;
- the full six-key `scope` set.

A hospital staff `get` of `users/{uid}` is allowed only when the target's
`role == 'donor'` **and** `hasHospitalConsent(uid)` is true. Staff cannot list
`users`, so there is no directory. If the record is missing, withdrawn, an older
version or incomplete, the read is refused — the same answer as "no such donor",
so the refusal does not confirm whether a person exists.

## 5. Versioning

The consent version lives in `web/src/utils/consent.js` (`CONSENT_VERSION`) and
is duplicated in `firestore.rules`. **Bump both together** whenever the consent
text's substance changes. Doing so invalidates older consents: hospitals lose
access until the donor agrees to the new version, rather than the old agreement
being carried forward silently.

## 6. Withdrawal

The donor withdraws on `/donor/consent`, optionally recording a reason. The
record's `status` becomes `revoked`, `revokedAt` and `revokedReason` are set, and
the document is kept. Hospitals lose access immediately; the same donor may
re-grant later, which starts a new `grantedAt`.

Withdrawal does not delete:

- donation records a hospital already holds for blood-safety traceability;
- the consent record itself, which is evidence that consent existed and was
  withdrawn (RA 10173 accountability).

## 7. Evidence and tests

The rules cases live in `firestore.rules.test.mjs`: staff denied before consent
and after withdrawal, allowed after a grant, denied on an old version, denied a
list, denied the consent record; donor cannot write another's record; admin
revoke-only; no deletes. Run with `npm run test:rules` (needs Java and the
emulator).

> **Status:** the suite was executed on 2026-11-01 and exited 0 with **156
> asserts, 0 failed**. The machine has no system Java, so a portable Temurin JRE
> 21 was unpacked into a temp directory for the run. The rules are still **not
> deployed** to the live project (PHASES §10), so the security claims above are
> emulator- and review-backed, not live-verified.
