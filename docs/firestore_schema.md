# Firestore Schema Specification — Blood Donation Platform

Source: `ERD.drawio` (19 tables, 23 relationships), converted to Firestore collections.
**Model of record** for the data model: what the build holds today, updated as the
build moves. It is not a cap on the model — see §0 for how additions and
deviations are handled, and §9 for the questions that are still open.

---

## 0. Status of this file (read before §0's instructions)

This is the **data model of record** for the repo: collections, fields, indexes,
transactions, the rules outline, and the seed data. Build against it.

Where the shipped build deliberately differs, the `D*` row in
`docs/REQUIREMENTS.md` is the authority — follow the deviation, not this file,
and do not "correct" the live code back to the text below:

| Area | This file says | The build does | Why |
|---|---|---|---|
| Reward points | an ERD-side total | one record per donation, summed on read | D12 |
| Deferral intervals | one interval | per component, in `donationTypes.intervalDays` | D13 |
| `users.lastDonationAt` | writable | frozen for the owner; only F8's server transaction writes it | D14 |
| `errorLogs` | an ERD-free collection §1 lists as [ADDED] | client-written, open-create; `build` is `mode:12-character Git SHA` | D8, D10, D17, D36 |
| `systemConfig.radiusTiers` | §8's 3 illustrative tiers | NFR-05's 5-tier ladder (5→25 km) | D18 |
| `users.address` | an ERD postal address | not collected; no field | D22 |

§9 below is the file's own list of ERD inconsistencies. **They are open questions,
not defaults**: an owner answer is recorded as a `D*` row, and unanswered ones are
re-stated in `docs/PHASES.md` §10 until they are settled.

---

## 0.1 Instructions for the AI agent

- Implement the collections and fields below. **You may add a collection or field the design needs** — the schema is a model of record, not a cap. When you add one, write it into this file (and `docs/SCHEMA_CHANGELOG.md`) in the same task, and add a `D*` row in `docs/REQUIREMENTS.md` when it departs from what is written here or from the ERD. Nothing is forbidden; everything is visible.
- Anything marked **[ADDED]** is not in the ERD — the build put it there, either because Firestore needs it (no joins, no unique constraints, no auto-increment) or because the design does. Keep these.
- Anything marked **[DECISION]** is a design choice where the ERD was ambiguous. Follow the choice stated here unless the owner says otherwise.
- Section 9 lists open questions. Do not silently guess on those; surface them — same as an addition: record the answer, do not assume it.

### Conventions

| Topic | Rule |
|---|---|
| Field naming | `camelCase` (ERD `snake_case` converted; ERD `lastDonationAt` was already camelCase) |
| Collection naming | `camelCase`, plural |
| Document IDs | Auto-ID unless a deterministic ID is specified (used to enforce uniqueness / 1:1) |
| Foreign keys | Stored as the **document ID string** of the target (not a `DocumentReference`) |
| Dates | Firestore `Timestamp` |
| Nullable | ERD fields marked `?` are optional/nullable. Store as `null` or omit; the agent must handle both |
| Unique (UK) | Firestore has no unique constraint. Enforced by deterministic doc ID or a transaction (noted per collection) |
| Enums | Stored as strings. Allowed values listed per field |
| Server-only | Collections marked **server-only** must only be written by Cloud Functions / Admin SDK |
| Timestamps | Use `FieldValue.serverTimestamp()` for `createdAt` / `updatedAt` etc. |

### Shared enums

```
Role            : "donor" | "hospital" | "admin"        (lowercase; D1 — Recipient merges into donor, no separate Staff role)
EntityStatus    : "Active" | "Suspended" | "Removed"    (users, hospitals, subscriptions, bloodRequests per ERD)
BloodType       : "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"   [ADDED: ERD doesn't list values]
ScreeningStatus : "Cleared" | "Deferred" | "Rejected"
VerificationPurpose : "Registration" | "Password reset"
```

---

## 1. Collection tree

```
users/{uid}
emailVerifications/{verificationId}                  (server-only)
hospitals/{hospitalId}
  ├─ subscriptions/{subscriptionId}
  └─ inventory/{stockKey}                           ← doc ID = blood type (enforces UK hospital+component+bloodType)
       └─ logs/{logId}
bloodRequests/{requestId}
donorMatches/{requestId}_{donorId}                   ← deterministic ID prevents duplicate matches
donorConsents/{consentId}
donationTypes/{donationTypeId}
  └─ guidelines/{guidelineId}
notifications/{notificationId}
donations/{matchId}                                  ← doc ID = matchId (enforces 1:1 with match)
rewardTransactions/{donationId}                      ← doc ID = donationId (enforces UK donation_id, 1:1)
systemConfig/global                                  ← single doc in practice; the rules allow any configId
dataSubjectRequests/{dsrId}
donorCommitments/{donorId}                           [ADDED] server-owned active-acceptance lock (D42)
donorLocations/{donorId}                             [ADDED] donor coordinate mirror for staff (D31)
auditBlocks/{blockId}                                (server-only, append-only)
accountOperations/{operationHash}                    [ADDED] server-only recovery (D40)
inventoryOperations/{operationHash}                 [ADDED] server-only movement receipts (D63)
auditOutbox/{operationHash}                          [ADDED] server-only delivery (D40)
auditContexts/{recordHash}                           [ADDED] erasable event details (D40)
auditRedactions/{hashedUserRef}                      [ADDED] persistent erasure tombstone (D40)
errorLogs/{logId}                                    [ADDED] client-written, open-create (D8, D10, D17)
```

### ERD table → Firestore mapping

| ERD table | Firestore path | Why |
|---|---|---|
| Users | `users/{uid}` | Doc ID = Firebase Auth UID |
| Email_Verification | `emailVerifications/{id}` | Top-level, server-only |
| Hospitals | `hospitals/{hospitalId}` | Top-level |
| Subscriptions | `hospitals/{id}/subscriptions/{id}` | Always owned by one hospital |
| Blood_Requests | `bloodRequests/{id}` | Queried across hospitals by status/geo |
| Donation_Types | `donationTypes/{id}` | Small reference data |
| Eligibility_Guidelines | `donationTypes/{id}/guidelines/{id}` | Always read with its donation type |
| Donor_Matches | `donorMatches/{requestId}_{donorId}` | Queried by donor and by request |
| Donor_Consents | `donorConsents/{id}` | Legal record, queried by donor |
| Notifications | `notifications/{id}` | Queried by user |
| Donations | `donations/{matchId}` | 1:1 with match |
| Reward_Transaction | `rewardTransactions/{donationId}` | 1:1 with donation |
| Blood_Inventory | `hospitals/{id}/inventory/{stockKey}` | Unique per hospital+bloodType |
| Inventory_Logs | `hospitals/{id}/inventory/{bt}/logs/{id}` | Child of an inventory row |
| System_Config | `systemConfig/global` | Singleton in practice — the app only ever writes `global`; the rules match `{configId}` |
| Radius_Tiler (sic) | embedded in `systemConfig/global.radiusTiers[]` | Small ordered list, always read with config |
| Data_Subject_Request | `dataSubjectRequests/{id}` | Top-level |
| Audit_Block | `auditBlocks/{id}` | Top-level, server-only |
| *(no ERD table)* | `errorLogs/{id}` | [ADDED] Client error records, create-only (D8, D10, D17) |
| *(no ERD table)* | `donorLocations/{id}` | [ADDED] Donor coordinate mirror for the nearby-donor view (D31) |

---

## 2. Collections in detail

Legend: **R** = required, **O** = optional/nullable.

> Reminder: `users/{uid}` (§2.1) now matches this table, including the lowercase
> role set. `isVerified` is not stored (D5) and `address` is not collected (D22).

### 2.1 `users/{uid}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| (doc ID) | string | R | = Firebase Auth UID (ERD `user_id`) |
| hospitalId | string | O | FK → `hospitals`. Only for Staff (and possibly Admin) |
| role | string | R | `donor \| hospital \| admin` |
| fullName | string | R | |
| email | string | R | **UK**. Uniqueness enforced by Firebase Auth |
| phoneNumber | string | R | |
| photoURL | string | O | [ADDED] HTTPS Cloudinary image delivery URL, up to 2048 characters. Missing or `''` displays initials. Owner-editable for donor, hospital and admin accounts; cleared by account anonymisation. The image is hosted outside Firestore (D40). |
| ~~hashedPassword~~ | – | – | **[DECISION]** Do NOT store. Firebase Auth manages credentials. See §9 |
| geohash | string | O | Geohash of the user's location, for proximity queries |
| latitude | number | O | |
| longitude | number | O | |
| city | string | O | City label; the scheduled proximity matcher currently queries coordinates/geohash |
| lastDonationAt | Timestamp | O | Used for eligibility interval checks. Owner-frozen (D14) |
| bloodType | string | O | `BloodType`. ERD `?` |
| dateOfBirth | Timestamp | R | |
| ~~eligibilityInfo~~ | – | – | **Removed from the model of record** (D25). The ERD's field was never implemented and eligibility is computed, not stored |
| ~~isVerified~~ | – | – | **[DECISION]** Do NOT store. Firebase Auth owns email verification (`user.emailVerified`); a copy would need a writer to stay true. See D5 |
| status | string | R | `Active \| Suspended \| Removed`. Server-owned account operation (D40) |
| statusReason | string | O | Admin reason recorded when suspending (D26); cleared on reactivate |
| statusUpdatedAt | Timestamp | O | Set when status changes (D26) |
| loginState | string | O | D40: `Provisioning \| Available \| Deleting \| Deleted`; absent on legacy profiles |
| loginDeletedAt | Timestamp | O | D40: permanent Auth deletion completed |
| provisioningOperationId | string/null | O | D40: owning operation hash during creation; null when complete |
| accountOperationId | string/null | O | D40: owning login-deletion operation; null when complete |
| personalDataErased | boolean | O | D40: true prevents restoration after erasure |
| privacyConsentAt | Timestamp | O | Server time the privacy notice was accepted at registration (D28); owner-frozen |
| privacyNoticeVersion | string | O | Version of the `/privacy` notice accepted, e.g. `2026-10-29` (D28); owner-frozen |
| createdAt | Timestamp | R | |

> Note: owners may initially fill `bloodType` and `dateOfBirth`, then cannot
> change or clear either value through client writes once it is non-empty
> (D48). Admin corrections remain available. Request acceptance additionally
> requires `fullName`, `bloodType`, `dateOfBirth`, and `city` (D49); phone and
> coordinates are optional.

Role/hospital claims: also set Firebase Auth **custom claims** `{ role, hospitalId }` for security rules **[ADDED]**.

> Note: `privacyConsentAt` / `privacyNoticeVersion` are optional because accounts
> provisioned outside registration (a first Google sign-in, hospital accounts
> made by the team) have no recorded acceptance. The rules type-check them and
> freeze both presence and value for the owner, so the browser cannot rewrite or
> remove an acceptance.

> Note: `address` is deliberately **not** collected on a donor profile (D22), so it is
> not part of this shape even though the ERD implies a postal address.

> Note: **eligibility is derived on read**, never stored. `utils/eligibility.js`
> computes it from `dateOfBirth` and `lastDonationAt`, and `firestore.rules`
> refuses a write containing an `eligibility` key — that rule name is the key it
> blocks, not a field, so the guard must keep the name a client would try (FR-031).

### 2.2 `emailVerifications/{verificationId}` — server-only

| Field | Type | R/O | Notes |
|---|---|---|---|
| userId | string | R | FK → `users` |
| hashedCode | string | R | Hash of the code, never the plain code |
| purpose | string | R | `Registration \| Password reset` |
| expiresAt | Timestamp | R | Enable Firestore **TTL policy** on this field **[ADDED]** |
| isUsed | boolean | R | Default `false` |

### 2.3 `hospitals/{hospitalId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| createdBy | string | R | FK → `users` (assumed, ERD has no edge. See §9) |
| provisioningOperationId | string/null | O | D40: exclusive creation reservation; cleanup may delete only a matching owner |
| createdAt | Timestamp | O | Server provisioning timestamp |
| updatedAt | Timestamp | O | Server provisioning/update timestamp |
| name | string | R | |
| address | string | R | |
| city | string | O | Stored by hospital provisioning and admin profile editing; city label for the saved facility location (D52) |
| latitude | number | R | |
| longitude | number | R | |
| geohash | string | R | **[ADDED]** needed for proximity search |
| contactNumber | string | R | |
| status | string | R | `Active \| Suspended \| Removed` |

> D52: hospital staff cannot change facility address, city, latitude, longitude
> or geohash through client writes. Hospital owners also cannot change the
> mirrored city/coordinates/geohash on `users/{uid}`. The admin account editor
> updates the facility and its selected staff profile together through the
> Worker, with an audit event. Existing blood-request location snapshots are
> not rewritten; corrected facility details apply to newly posted requests.

#### 2.3.1 `hospitals/{hospitalId}/subscriptions/{subscriptionId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| plan | string | R | Plan values not specified in ERD |
| startDate | Timestamp | R | |
| endDate | Timestamp | R | |
| status | string | R | `Active \| Suspended \| Removed` (as in ERD, see §9) |

(`hospitalId` is implied by the path. Also write it as a field if you want collection-group queries **[ADDED]**.)

#### 2.3.2 `hospitals/{hospitalId}/inventory/{stockKey}`

D63: doc ID is `{component}_{bloodType}` (for example `rbc_O-`). The identity is unique per facility, component and blood group. Legacy group-only IDs remain unclassified/read-only and are excluded from usable stock; no automatic migration assigns a component.

| Field | Type | R/O | Notes |
|---|---|---|---|
| bloodType | string | R | Actual collected/issued donor blood group |
| component | string | R | D63: `whole-blood`, `rbc`, `platelets`, `plasma`, `cryoprecipitate` |
| unitsAvailable | number (int) | R | Update only via transaction / increment |
| lastUpdated | Timestamp | R | |

#### 2.3.3 `hospitals/{hospitalId}/inventory/{stockKey}/logs/{logId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| donationId | string | O | FK → `donations`. Null for manual adjustments / usage |
| userId | string | R | FK → `users`, who made the change |
| changeType | string | R | Values not in ERD. Suggested: `Donation \| Usage \| Adjustment \| Expired` |
| unitsChanged | number (int) | R | Positive or negative |
| component, bloodType | string | R | D63: movement stock identity |
| reason | string | O | Adjustment explanation, up to 2000 characters |
| createdAt | Timestamp | R | |

D63: only the authenticated Worker writes stock/logs, in one transaction with its operation record and audit outbox. Client writes are denied, including administrators. Screening and donation creation/updates are server-only too. Direct owner/admin profile edits cannot alter `lastDonationAt`.

### 2.4 `bloodRequests/{requestId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| recipientId | string | O | FK → `users` (ERD `?`) |
| hospitalId | string | R | FK → `hospitals` |
| createdBy | string | O | FK → `users` (ERD `?`) |
| bloodType | string | R | `BloodType` |
| component | string | R | FK → `donationTypes/{id}` — `whole-blood \| rbc \| platelets \| plasma \| cryoprecipitate`. **[ADDED]** (D24) |
| quantity | number (int) | R | Units needed |
| transfusedUnits | number (int) | O | D63: server-owned cumulative request-linked issuance; request is fulfilled when this reaches quantity |
| urgencyLevel | string | R | `urgent \| stat \| routine` — the `.chip[data-priority]` tones the UI renders (D24) |
| status | string | R | `urgent \| collecting \| matched \| fulfilled \| cancelled` — the shipped `.chip[data-status]` set (D24). The ERD's `Active \| Suspended \| Removed` was a copy-paste error (see §9) |
| createdAt | Timestamp | R | |
| hospitalName, latitude, longitude, geohash | string / number | R | **[ADDED, denormalized]** copied from the hospital at creation, so matching by radius needs no extra read |
| matching | map | O | **[ADDED]** Server-written by the F7 matching Worker: `{ currentTier, nextTierAt, lastRunAt, lastRunMs, matchedDonorCount, exhausted }`. Clients never write it — the create rule ignores the key and only the Worker's Admin path sets it. |

> Note: `urgent` appears in **both** `status` and `urgencyLevel`. That is the
> shipped vocabulary, not an accident to normalise away (D24) — an urgent request
> is also urgent priority.

> Note: `matching` is the matcher's state on the request (which radius tier it
> is on, when the next tier opens, and whether it exhausted the ladder). It is
> absent until the first match run; the matcher treats a missing block as
> `currentTier: 0`. D51: `exhausted: true` means the radius ladder has reached
> its maximum, not that matching has stopped. Open (`urgent`/`collecting`)
> requests continue searching at the current/max radius on scheduled runs for
> donors who register or become eligible later. A rescan updates `lastRunAt`
> but preserves `nextTierAt` until an expansion is due. The scheduled queue
> rotates batches of 20 by oldest `lastRunAt`, then processes the batch in
> urgency order. No additional fields or indexes are needed.

### 2.5 `donorMatches/{requestId}_{donorId}`

D63 adds optional `donorBloodType` (string) as a matcher snapshot for staff display. Existing matches may omit it; confirmation always reads the current donor profile. No recipient blood-group fallback is used for collected stock. Screening is Worker-only and validates active Data Sharing/Screening consents.


| Field | Type | R/O | Notes |
|---|---|---|---|
| requestId | string | R | FK → `bloodRequests` |
| donorId | string | R | FK → `users` |
| donationTypeId | string | R | FK → `donationTypes` |
| screenedByUserId | string | O | FK → `users` (ERD `?`), staff who screened |
| responseStatus | string | R | Values not in ERD. Suggested: `Pending \| Accepted \| Declined \| Expired` |
| screeningStatus | string | O | `Cleared \| Deferred \| Rejected` (ERD `?`) |
| guidelinesAcknowledged | boolean | R | Default `false` |
| acknowledgedAt | Timestamp | O | Set when guidelinesAcknowledged becomes true |
| matchedAt | Timestamp | R | |

D71: `GET /hospital/request-responses` reads the request, matches, current
match-specific Data Sharing consents and donor profiles in one server transaction.
Active staff claims/profile must agree on the request’s hospital; the facility must
be active. Accepted matches with unrevoked consent return only name, email, phone,
blood type and city from an active, unerased donor profile. Other rows return no
donor identity. Client `users` reads stay owner/admin only. Pages use 25 matches
ordered by document ID and an exclusive document-name cursor; the optional exact
response filter uses the existing requestId/responseStatus index. No stored fields
or indexes are added.

### 2.6 `donorConsents/{consentId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| donorId | string | R | FK → `users` |
| matchId | string | O | FK → `donorMatches` (ERD `?`) |
| consentType | string | R | Values not in ERD |
| grantedAt | Timestamp | R | |
| revokedAt | Timestamp | O | Null while active. Never delete the doc, set this |

### 2.7 `donationTypes/{donationTypeId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| name | string | R | e.g. Whole Blood, Platelets, Plasma |
| intervalDays | number (int) | R | Minimum days between donations |

#### 2.7.1 `donationTypes/{donationTypeId}/guidelines/{guidelineId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| title | string | R | |
| description | string | R | |

Relationship in ERD is **1 → 1..many**: every donation type should have at least one guideline.

### 2.8 `notifications/{notificationId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| userId | string | R | FK → `users` |
| requestId | string | R | FK → `bloodRequests` |
| channel | string | R | Values not in ERD. Suggested: `Push \| SMS \| Email` |
| deliveryStatus | string | R | Suggested: `Pending \| Sent \| Failed` |
| retryCount | number (int) | R | Default `0`. Compare against `systemConfig.notifRetryLimit` |
| readAt | Timestamp | O | **[ADDED]** D42: server-written when the owner marks an alert as read; absent means unread. |
| sentAt | Timestamp | O | Null until sent. **Write it as an explicit `null` at create**: the donor inbox (§4) orders by `sentAt`, and Firestore omits documents that lack the orderBy field. |

### 2.9 `donations/{matchId}`

D68/D69 reporting reads keep the hospital equality scope and date-descending
cursor order. `getHospitalDonations` accepts optional `since` (inclusive) and
`until` (exclusive) date bounds; an inclusive PHT end day is the next PHT midnight
passed as `until`. No new stored fields or composite index are introduced. Admin
account-directory reads expose the existing `users.createdAt` as a Date for
creation-date filtering (D69).

Doc ID = the `donorMatches` doc ID. One donation per match (ERD 1:1).

| Field | Type | R/O | Notes |
|---|---|---|---|
| matchId | string | R | Same as doc ID |
| confirmedBy | string | R | FK → `users` (staff) |
| donationDate | Timestamp | R | |
| units | number (int) | R | |
| confirmedAt | Timestamp | R | |
| donorId, hospitalId, bloodType | string | R | **[ADDED, denormalized]** from the match/request. ERD has no donorId on Donations, only via match |

D63: donation records also carry `component` (request component code), `donationType` (interval-bearing reference ID), and `requestId`. The Worker derives the blood group from the donor profile; confirmation atomically writes the donation, matching component/group stock and log, donor clock, operation and audit outbox. Rewards remain removed by D43.

### 2.10 `rewardTransactions/{donationId}` — legacy only (D43)

Doc ID = `donationId` so UK(donation_id) holds. D43 removes future rewards; existing documents remain available to historical data export.

| Field | Type | R/O | Notes |
|---|---|---|---|
| donorId | string | R | FK → `users` |
| donationId | string | R | Same as doc ID |
| points | number (int) | R | |
| awardedAt | Timestamp | R | |

### 2.11 `systemConfig/global` — singleton

ERD `System_Config` + `Radius_Tiler` merged. Tiers are small and always read together.

| Field | Type | R/O | Notes |
|---|---|---|---|
| updatedBy | string | R | FK → `users` (Admin). Must equal the writer's uid (D27) |
| notifRetryLimit | number (int) | R | Max retries per notification, 0–10 (D27) |
| notifRetryInterval | number | R | Unit unspecified. **[DECISION]** minutes, 1–1440 (D27) |
| radiusTiers | array of map | R | 1–8 items, each within the bounds below (D27) |
| updatedAt | Timestamp | R | Server time; must equal `request.time` (D27) |

`radiusTiers[]` item (ERD `Radius_Tiler`; `tier_id` and `config_id` dropped as redundant):

| Field | Type | Notes |
|---|---|---|
| tierOrder | number (int) | 1 = searched first; 1–8 (D27) |
| radiusKm | number | Search radius, 1–100 km (D27) |
| waitMinutes | number | Wait before expanding to the next tier, 1–1440 min (D27) |

Keep the array sorted by `tierOrder`, with each `radiusKm` larger than the one
before it; the settings screen and `isRadiusTiers()` refuse anything else.

### 2.12 `dataSubjectRequests/{dsrId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| userId | string | R | FK → `users` |
| processedBy | string | O | `users` id of the admin (ERD has no FK marker. See §9) |
| requestType | string | R | `Access \| Erasure \| Rectification \| Export \| Other`; required by rules and submit form (D27, D80) |
| status | string | R | `Pending \| InProgress \| Completed \| Rejected`; required by the rules (D27) |
| details | string | R | [ADDED] What the subject is asking for, nonblank and ≤2000 chars; required on create, including Other (D27, D80) |
| adminNote | string | O | [ADDED] Admin note/summary of the action taken, ≤2000 chars (D26/D27) |
| resolutionAction | string | O | [ADDED] `'' \| Export \| Correction \| Deletion \| Response` — the recorded action; Response supports written answers to Other requests (D27, D80) |
| rejectionReason | string | O | [ADDED] `'' \| InsufficientDetails \| Duplicate \| OutsideScope \| Other`; a valid nonempty category plus nonblank `adminNote` is required when rejecting. Historical records may omit it (D80) |
| createdAt | Timestamp | R | Server time; frozen after create |
| resolvedAt | Timestamp | O | ERD `?`. Null while open; server time when `Completed`/`Rejected` |

Closed requests (`Completed`/`Rejected`) are immutable to clients and never deleted. Rejection preserves the original request and response. Completion requires a nonblank response and recorded action. Both outcomes require server `resolvedAt` and the current active admin as `processedBy` (D80).

### 2.13 `auditBlocks/{blockId}` — server-only, append-only

Hash-chained audit log. **Never update or delete.**

| Field | Type | R/O | Notes |
|---|---|---|---|
| prevHash | string | R | `recordHash` of the previous block (genesis block: `"0"`) |
| recordHash | string | R | **UK**. Use as doc ID, or check in transaction |
| eventType | string | R | |
| entityType | string | O | Type of entity affected (e.g., donation, inventory, user, request) |
| hashedEntityRef | string | R | Hash of the affected entity ID, never the raw ID |
| hashedActorRef | string | R | Hash of the actor ID, never the raw ID |
| actorRole | string | O | Role of the actor who performed the action |
| createdAt | Timestamp | R | |
| sequence | number (int) | R | **[ADDED]** monotonically increasing, assigned in a transaction reading the last block. Firestore has no auto-increment |
| correctsBlockId | string | O | **[ADDED]** Doc ID of the block this entry corrects (for append-only corrections per FR-043) |
| contextHash | string | O | D40: HMAC of canonical reason/beforeStatus/afterStatus; included in record hash only when present; context remains erasable |

> Note: a reserved document `auditBlocks/_meta` (`{ headSequence, headHash,
> updatedAt }`) is written by the append transaction. It carries **no
> `sequence` field**, so it never appears in the sequence-ordered chain queries.
> Appends read it inside the transaction to serialize, so two concurrent
> appends cannot fork the chain (schema §5).

---

### 2.14 `donorLocations/{donorId}` — [ADDED] (D31)

A thin coordinate mirror for the hospital's nearby-donor view (FR-023). Doc ID
is the donor's uid; written by the donor when they save a profile that has
coordinates, read by staff of the matching hospital and admins.

| Field | Type | R/O | Notes |
|---|---|---|---|
| donorId | string | R | = doc ID; FK → `users` |
| latitude | number | R | |
| longitude | number | R | |
| city | string | O | |
| geohash | string | O | |
| bloodType | string | O | so staff can filter without reading `users` |
| updatedAt | Timestamp | R | |

### 2.15 `accountOperations/{operationHash}` — [ADDED] (D40)

Server-only. ID is HMAC of actor UID and caller retry key. Fields:
`action` (`createHospital|deleteLogin|status|erase|editProfile`), `actorId`, `targetUid`, optional
`hospitalId`, keyed `fingerprint`, `state` (`Pending|Completed|Failed`),
`createdAt`, `updatedAt`, optional `nextAttemptAt`, `completedAt`,
`leaseToken`, `leaseUntil`, `recoveryState`, `failureMessage`, `reason`, and
`result` (`{uid,hospitalId?}`). Pending external operations hold a five-minute
lease; completion clears lease and reason. Passwords/tokens are never stored.
Record IDs/technical references are private operational metadata outside the
immutable chain. There is no client read/write path.

### 2.16 `auditOutbox/{operationHash}` — [ADDED] (D40)

Pending fields: `state: Pending`, `nextAttemptAt`, `createdAt`, `eventType`,
`entityType: user`, raw `entityId`/`actorId`, `actorRole: admin`, and
`context: {reason,beforeStatus,afterStatus}`. Created in the same transaction as
the account mutation. Delivery atomically replaces the entire document with
`{state: Delivered,recordHash,deliveredAt}`, removing raw references/reasons.
Retaining the acknowledgement deduplicates retries. Server-only reads/writes.

### 2.17 `auditContexts/{recordHash}` — [ADDED] (D40)

Erasable sidecar: `reason` (≤2000 chars), `beforeStatus`, `afterStatus`,
`hashedEntityRef`, `hashedActorRef`. Created atomically with the chain block.
Its canonical reason/status data is HMAC-bound to `auditBlocks.contextHash`.
There are no dedicated identity snapshots; a free-form reason may contain personal
data and is erasable. Server-only access; a later authorized
history endpoint must honor redaction tombstones before returning details. D50 implements `GET /accounts/history`: active-admin authorization, subject-scoped cursor pagination, context-digest verification and tombstone checks. Current administrator identities are resolved from a bounded 100-profile query; unresolved identities remain unavailable. No identity snapshots or new stored fields are added.

### 2.18 `auditRedactions/{hashedUserRef}` — [ADDED] (D40)

Persistent HMAC-only erasure tombstone: `state: Pending|Completed`,
`nextAttemptAt`, `createdAt`. Exists as soon as erasure commits. Audit delivery
suppresses context when subject or actor has a tombstone. Bounded maintenance
queries and deletes old context by hashedEntityRef/hashedActorRef; the tombstone
remains after completion. No immutable block is updated or deleted.

### 2.19 `donorCommitments/{donorId}` — [ADDED] (D42)

Server-owned singleton, read only by its donor. Fields: `donorId`, `matchId`,
`requestId` (strings), and `acceptedAt` (Timestamp). `POST /donor/respond` reads
this document and all prior Accepted matches inside the same transaction, then
writes the singleton, accepted match and two consent records together. The stored
pointer may outlive the donation: the next transaction checks donation existence,
request closure and screening outcome before replacing it. Existing accepted
matches without a lock are checked too; no migration silently cancels them.

### 2.20 `inventoryOperations/{operationHash}` — [ADDED] (D63)

Server-only idempotency receipts: `fingerprint` (HMAC of the normalized operation), `createdAt` (Timestamp), and `result` (operation outcome with facility, component/group and stock count or screening status). Confirmation keys are HMACs of the match ID; other keys bind the actor UID and client operation UUID. Reusing a key with different input fails. The receipt commits with all domain writes and audit outbox entries. No raw reason or credential is stored in the receipt. Client read/write is denied.

## 3. Relationships (from ERD)

Cardinality read from the crow's-foot notation.

| Parent (1) | Child (many) | Via | Cardinality |
|---|---|---|---|
| hospitals | users | `users.hospitalId` | 0..1 → 0..N |
| users | emailVerifications | `userId` | 1 → 0..N |
| hospitals | subscriptions | path | 1 → 0..N |
| hospitals | bloodRequests | `hospitalId` | 1 → 0..N |
| users | bloodRequests | `recipientId` / `createdBy` | 1 → 0..N |
| bloodRequests | donorMatches | `requestId` | 1 → 0..N |
| users | donorMatches | `donorId` | 1 → 0..N |
| donationTypes | donorMatches | `donationTypeId` | 1 → 0..N |
| donationTypes | guidelines | path | 1 → 1..N |
| donorMatches | donorConsents | `matchId` | 1 → 0..N |
| users | notifications | `userId` | 1 → 0..N |
| bloodRequests | notifications | `requestId` | 1 → 0..N |
| donorMatches | donations | doc ID | **1 ↔ 1** |
| users | donations | `confirmedBy` | 1 → 0..N |
| donations | rewardTransactions | doc ID | **1 ↔ 1** |
| users | rewardTransactions | `donorId` | 1 → 0..N |
| hospitals | inventory | path | 1 → 0..N |
| inventory | logs | path | 1 → 0..N |
| donations | logs | `donationId` | 0..1 → 0..N |
| users | logs | `userId` | 1 → 0..N |
| users | systemConfig | `updatedBy` | 1 → 0..N |
| systemConfig | radiusTiers | embedded | 1 → 0..N |
| users | dataSubjectRequests | `userId` | 1 → 0..N |

`auditBlocks` has no relationships in the ERD (references are hashed on purpose).

---

## 4. Composite indexes to create

| Collection | Fields | Used for |
|---|---|---|
| `users` | `role` ASC, `status` ASC, `bloodType` ASC, `geohash` ASC | Find active donors of a blood type in a geohash range |
| `bloodRequests` | `hospitalId` ASC, `status` ASC, `createdAt` DESC | Hospital's request list |
| `bloodRequests` | `status` ASC, `createdAt` DESC | Active request feed |
| `bloodRequests` | `recipientId` ASC, `createdAt` DESC | Recipient's own requests |
| `donorMatches` | `donorId` ASC, `matchedAt` DESC | Donor's match history |
| `donorMatches` | `requestId` ASC, `responseStatus` ASC | Responses to a request |
| `notifications` | `userId` ASC, `sentAt` DESC | User inbox |
| `notifications` | `deliveryStatus` ASC, `retryCount` ASC | Retry worker |
| `donations` | `donorId` ASC, `donationDate` DESC | Donor history |
| `donations` | `hospitalId` ASC, `donationDate` DESC | Hospital reporting |
| `donorConsents` | `donorId` ASC, `grantedAt` DESC | Consent history |
| `dataSubjectRequests` | `status` ASC, `createdAt` ASC | Admin work queue |
| `auditBlocks` | `sequence` DESC | Fetch the latest block |
| `auditBlocks` | `hashedEntityRef` ASC, `entityType` ASC, `sequence` DESC | D50: account history with exclusive sequence cursor (25 rows/page) |
| `auditBlocks` | Every subset of account (`hashedEntityRef` ASC + `entityType` ASC), actor (`hashedActorRef` ASC), event (`eventType` ASC), followed by `createdAt` DESC, `sequence` DESC | D56: eight additive indexes for global activity filters and exclusive timestamp/sequence cursors; 25 records/page |
| `accountOperations` | `state` ASC, `nextAttemptAt` ASC | D40 due recovery work |
| `auditOutbox` | `state` ASC, `nextAttemptAt` ASC | D40 due event delivery |
| `auditRedactions` | `state` ASC, `nextAttemptAt` ASC | D40 bounded erasure cleanup |
| collection group `logs` | `createdAt` DESC | Cross-hospital inventory audit |

TTL policy: `emailVerifications.expiresAt`.

---

## 5. Where the agent must use transactions / server logic

1. **Registering a user**: donor registration remains client-driven. Hospital provisioning reserves a UID/profile/facility in a server transaction, creates a disabled Auth user, publishes claims, enables the login, then atomically activates records and queues the audit event (D40).
2. **Accepting a match (D42)**: use a transaction over `donorCommitments/{uid}`, prior accepted matches and request/donation state. Commit response, acknowledgment, two consent records and lock together.
3. **Creating a match**: use the deterministic ID `{requestId}_{donorId}`. Fail if it exists.
4. **Confirming a donation**: in ONE transaction: create `donations/{matchId}`, update the actual donor/component `hospitals/{h}/inventory/{stockKey}.unitsAvailable`, write its log, set `users/{donorId}.lastDonationAt`, and create the idempotency receipt plus audit outbox records (D63).
5. **Inventory changes (D63)**: only Worker transactions, with facility/stock validation, an idempotency receipt and audit outbox. Perform every read before any write. Request-linked issuance atomically advances `transfusedUnits` and closes only a fully served request.
6. **Audit blocks**: read the head and latest block, compute the hash, and atomically write block/head/optional erasable context/outbox acknowledgement. Status/erasure mutations and their pending outbox event commit together (D40).
7. **Notification retries**: Cloud Function / scheduler reads `systemConfig/global` for `notifRetryLimit` and `notifRetryInterval`.
8. **Radius expansion**: scheduler walks `radiusTiers` in `tierOrder`, waiting `waitMinutes` between tiers, querying donors via geohash ranges.
9. **Eligibility check**: `now - users.lastDonationAt >= donationTypes.intervalDays`.

---

## 6. Security rules outline

Use custom claims `request.auth.token.role` and `request.auth.token.hospitalId`.

| Collection | Read | Write |
|---|---|---|
| `users/{uid}` | Owner; Admin; Staff of same hospital (limited) | Owner/admin personal fields; access/provisioning fields server-owned (D40); hospital-owner location fields frozen (D52) |
| `emailVerifications` | none | server-only |
| `hospitals` | Authenticated | Staff of that hospital: name/contact only; Admin; locations managed through the admin editor (D52) |
| `hospitals/*/subscriptions` | Staff of that hospital, Admin | Admin / server |
| `hospitals/*/inventory` + `logs` | Staff of that hospital, Admin | Worker only (D63); legacy group-only stock remains read-only |
| `bloodRequests` | Authenticated | Create: Recipient / Staff. Update status: Staff of hospital, Admin |
| `donorMatches` | Donor (own), Staff of request's hospital, Admin | D42: responses/acknowledgment/location server-only; screening and creation server-only (D63) |
| `donorCommitments` | Owner only | server-only (D42) |
| `donorConsents` | Donor (own), Admin | Donor create / set `revokedAt` only. No delete |
| `donationTypes` + `guidelines` | Authenticated | Admin |
| `notifications` | Owner | server-only |
| `donations` | Donor (own), Staff of hospital, Admin | Worker only (D63) |
| `rewardTransactions` | Donor (own), Admin | server-only |
| `systemConfig` | Admin (Authenticated may read tiers if needed) | Admin |
| `dataSubjectRequests` | Active owner, Admin | Owner create with nonblank details; active Admin updates open records only; closed records immutable; delete denied (D80) |
| `auditBlocks` | Admin | server-only, no update/delete |
| `inventoryOperations`, `accountOperations`, `auditOutbox`, `auditContexts`, `auditRedactions` | no client reads | server-only (D40) |

Sensitive/health data (`bloodType`, `dateOfBirth`, screening results) should never be readable by other donors.

---

## 7. TypeScript interfaces (for the agent's code)

```ts
import { Timestamp } from "firebase/firestore";

type Role = "Donor" | "Recipient" | "Staff" | "Admin";
type EntityStatus = "Active" | "Suspended" | "Removed";
type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
type ScreeningStatus = "Cleared" | "Deferred" | "Rejected";

interface User {
  hospitalId?: string | null;
  role: Role;
  fullName: string;
  email: string;
  phoneNumber: string;
  photoURL?: string;
  geohash?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  lastDonationAt?: Timestamp | null;
  bloodType?: BloodType | null;
  dateOfBirth: Timestamp;
  status: EntityStatus;
  createdAt: Timestamp;
}

interface EmailVerification {
  userId: string;
  hashedCode: string;
  purpose: "Registration" | "Password reset";
  expiresAt: Timestamp;
  isUsed: boolean;
}

interface Hospital {
  createdBy: string;
  name: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
  geohash: string;
  contactNumber: string;
  status: EntityStatus;
}

interface Subscription {
  plan: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: EntityStatus;
}

interface InventoryItem {            // hospitals/{h}/inventory/{stockKey}
  bloodType: BloodType;
  component: string;
  unitsAvailable: number;
  lastUpdated: Timestamp;
}

interface InventoryLog {             // .../inventory/{stockKey}/logs/{id}
  donationId?: string | null;
  userId: string;
  component: string;
  bloodType: BloodType;
  reason?: string;
  changeType: string;
  unitsChanged: number;
  createdAt: Timestamp;
}

interface BloodRequest {
  recipientId?: string | null;
  hospitalId: string;
  createdBy?: string | null;
  bloodType: BloodType;
  quantity: number;
  urgencyLevel: string;
  status: EntityStatus;
  createdAt: Timestamp;
  // denormalized [ADDED]
  hospitalName: string;
  latitude: number;
  longitude: number;
  geohash: string;
}

interface DonorMatch {               // id = `${requestId}_${donorId}`
  requestId: string;
  donorId: string;
  donationTypeId: string;
  screenedByUserId?: string | null;
  responseStatus: string;
  screeningStatus?: ScreeningStatus | null;
  guidelinesAcknowledged: boolean;
  acknowledgedAt?: Timestamp | null;
  matchedAt: Timestamp;
}

interface DonorConsent {
  donorId: string;
  matchId?: string | null;
  consentType: string;
  grantedAt: Timestamp;
  revokedAt?: Timestamp | null;
}

interface DonationType { name: string; intervalDays: number; }
interface EligibilityGuideline { title: string; description: string; }

interface Notification {
  userId: string;
  requestId: string;
  channel: string;
  deliveryStatus: string;
  retryCount: number;
  sentAt?: Timestamp | null;
}

interface Donation {                 // id = matchId
  matchId: string;
  confirmedBy: string;
  donationDate: Timestamp;
  units: number;
  confirmedAt: Timestamp;
  donorId: string;                   // [ADDED]
  hospitalId: string;                // [ADDED]
  bloodType: BloodType;              // [ADDED]
}

interface RewardTransaction {        // id = donationId
  donorId: string;
  donationId: string;
  points: number;
  awardedAt: Timestamp;
}

interface RadiusTier { tierOrder: number; radiusKm: number; waitMinutes: number; }
interface SystemConfig {             // systemConfig/global
  updatedBy: string;
  notifRetryLimit: number;
  notifRetryInterval: number;
  radiusTiers: RadiusTier[];
  updatedAt: Timestamp;
}

interface DataSubjectRequest {
  userId: string;
  processedBy?: string | null;
  requestType: "Access" | "Erasure" | "Rectification" | "Export" | "Other";
  status: "Pending" | "InProgress" | "Completed" | "Rejected";
  details: string;
  adminNote?: string;
  resolutionAction?: "" | "Export" | "Correction" | "Deletion" | "Response";
  rejectionReason?: "" | "InsufficientDetails" | "Duplicate" | "OutsideScope" | "Other";
  createdAt: Timestamp;
  resolvedAt?: Timestamp | null;
}

interface AuditBlock {
  prevHash: string;
  recordHash: string;
  eventType: string;
  hashedEntityRef: string;
  hashedActorRef: string;
  createdAt: Timestamp;
  sequence: number;                  // [ADDED]
}
```

---

## 8. Seed data the agent should create

- `systemConfig/global` with a sensible default: `radiusTiers: [{1, 5, 10}, {2, 10, 15}, {3, 15, 20}, {4, 20, 25}, {5, 25, 30}]`, `notifRetryLimit: 3`, `notifRetryInterval: 5`. The radii follow NFR-05's 5→10→15→20–25 km ladder (D18); `waitMinutes` extends the original 10/15/20 pattern and stays tunable (FR-041).
- `donationTypes`: Whole Blood (`intervalDays` 56), Platelets (7), Plasma (28), Double Red Cells (112), each with at least one guideline. Intervals are D13's per-component deferrals; guideline copy is a placeholder for the owner to edit.
- One Admin user — created in the Firebase console. The seed script
  (`scripts/seed-reference-data.mjs`) requires one to already exist and
  attributes `systemConfig/global.updatedBy` to it.
- One dev facility, `hospitals/tagaytay-blood-bank` (`createdBy` = the admin),
  so the F3 hospital area has a facility to post against. The seed writes it
  (`scripts/seed-reference-data.mjs`; `--link-email <address>` sets an existing
  account's `users.hospitalId`), and `npm run create:hospital`
  (`scripts/create-hospital.mjs`) creates the facility's login when none
  exists. Not part of the spec's seed list — a build convenience.

---

## 9. Open questions / ERD inconsistencies (agent: flag, don't guess)

> **Answered:** 2 (requests — D24; subscriptions still open), 5's `urgencyLevel` (D24), 6 (D25).
> The rest are open and re-stated in `docs/PHASES.md` §10.

1. **Passwords and verification**: ERD stores `hashed_password` and an `Email_Verification` table. With Firebase Auth both are normally handled by Auth. I omitted `hashedPassword` and kept `emailVerifications` in case you use custom OTP codes. Confirm.
2. **Copy-pasted status enum**: `Blood_Requests.status` and `Subscriptions.status` show `Active, Suspended, Removed` like Users/Hospitals. **Answered for requests:** the build's set is `urgent | collecting | matched | fulfilled | cancelled` (D24). **Still open for subscriptions**: `Active | Expired | Cancelled` is the suggestion, not a decision.
3. **Missing FK edges in the diagram**: `Hospitals.created_by`, `Donor_Matches.screened_by_user_id`, `Donations.confirmed_by`, `Data_Subject_Request.processed_by`, `Blood_Requests.created_by` — all assumed → `users`.
4. **`Donations` has no `donor_id`** — derived via match. I added `donorId`, `hospitalId`, `bloodType` as denormalized fields.
5. **Unspecified enum values** (suggested values given above): `urgencyLevel` **answered** — `urgent | stat | routine` (D24). DSR request types/statuses are resolved by D27/D80 (§2.12). Still open: `responseStatus`, `consentType`, `channel`, `deliveryStatus`, `changeType`, subscription `plan`.
6. **`eligibility_info`** type unknown. **Answered (D25):** the field was never implemented, eligibility is computed on read, and it was removed from the model of record. If a screening record is ever needed, it gets a purpose-designed field in that feature.
7. **`notif_retry_interval`** unit unknown. Assumed minutes.
8. **Radius_Tiler** is spelled "Tiler" in the ERD; treated as "Tiers".
9. **Embedding vs. collection** for radius tiers and guidelines: chosen for read efficiency. If admins need to edit tiers individually with history, make them subcollections instead.
10. **Privacy**: this stores health-related personal data and has a Data Subject Request table, so a data-protection law (e.g. GDPR / Philippine Data Privacy Act) likely applies. Erasure requests must be reconciled with append-only audit blocks (hence the hashed refs).


### D56 audit activity read contract

`GET /audit/activity` requires verified Active admin authority. Optional `account`, `actor`, `event`, `from`, `to` filters apply before the fixed 26-row query (25 results plus continuation detection). The exclusive cursor contains the last event's time and sequence. IDs are resolved from at most 500 `users` document names, cached for 60 seconds per project/HMAC key; explicit account/actor filter IDs also resolve. Current profile fields are fetched fresh and allowlisted. Unresolved/missing/erased identities stay unavailable. This adds no stored field, collection, or rules permission.

Context, current profiles and erasure tombstones use `:batchGet` chunks of 100 (at most 200 unique paths per helper call; at most 125 per activity page). Context is returned only if its allowlisted reason/status digest matches `contextHash` and neither subject nor actor has an erasure tombstone. Names/emails are never cached by this endpoint or copied to immutable blocks. The same batch helper bounds existing account-history context reads. A first-page emulator check with 25 distinct affected users uses five external requests including authorization; full-chain verification remains a separate explicit operation.
