# Personal data request procedure

**Features:** F9 (administrative processing) · F11 (process and documentation)
**Requirements:** NFR-19, FR-039, NFR-17
**Donor screen:** `/donor/privacy` (`web/src/pages/donor/Privacy.jsx`)
**Admin screen:** `/admin/data-requests` (`web/src/pages/admin/DataRequests.jsx`)
**Collection:** `dataSubjectRequests` (schema §2.12)

NFR-19 is shared: F9 built the request-and-process mechanism, F11 documents and
verifies the privacy process and closes the hospital-access gate on erasure. The
row stays `partial` until both halves are verified in a live project.

## 1. Who can ask, and how

Any signed-in account may submit a request for its **own** data on
`/donor/privacy` and read the requests it submitted. A person cannot open a
request in another person's name (enforced in the rules:
`request.resource.data.userId == request.auth.uid`).

## 2. Request types

| Type | What it asks for | What the queue does |
| --- | --- | --- |
| Access | a copy of what Dugo+ holds | builds the JSON data copy |
| Export | a portable copy | builds the JSON data copy |
| Rectification | correction of a wrong field | edits name/phone/city on the profile |
| Erasure | remove identifying details and close the account | withdraws consent, scrubs the profile, closes the account |

The request carries the requester's own words (`details`, ≤2000 chars). The
administrator adds `adminNote` and `resolutionAction` when closing it.

## 3. Lifecycle

`Pending → InProgress → Completed` (or `Rejected`). A closed request records
`processedBy`, `resolutionAction` and a server `resolvedAt`. `dataSubjectRequests`
is owner-create and admin-update; the subject, type and open time are frozen, and
a request is never deleted.

## 4. Erasure, step by step

1. The administrator records the reason for erasure in the note (required).
2. `revokeConsentOnErasure(userId, reason)` withdraws `donorConsents/{uid}` using
   the admin revoke-only rule. While the F11 ruleset is undeployed this call is
   refused by the older rules, so it is **best-effort**: the erasure still runs
   and the queue warns that the consent withdrawal could not be recorded and
   must be retried after the rules deploy. Once the rules are live the
   withdrawal lands first, before any identifying data is destroyed.
3. `anonymiseUser(userId, reason)` scrubs name, email, phone, city, coordinates,
   blood type and date of birth, and sets `status: 'Removed'`.
4. The sign-in record that still holds the email is deleted through the account
   service (`deleteAuthAccount` / the free worker), from `/admin/accounts`.

Donation, match and audit records are kept de-identified under
`docs/DATA_RETENTION_AND_DISPOSAL.md`.

## 5. Time and communication

The target is **15 working days**. The administrator replies using the note, and
the person sees the answer on `/donor/privacy`. Access/export copies are sent
over a channel the subject controls; the screen warns against insecure channels.

## 6. What is not covered here

- **Identity verification** before an access/export copy is released is a manual
  step: the current handling relies on the signed-in account's verified email
  (D5). A stronger procedure may be needed for high-risk requests.
- **Complaints** to the National Privacy Commission are outside the app; the
  notice states the right but the app does not route a complaint.
- **Legal holds and blood-safety retention** override erasure; that is why
  donation records survive an erasure.

> **Status:** the mechanism is built but has not been exercised against a live
> project here (no test-account credentials), and the rules are not deployed.
> Reported as `partial`, not `done`.
