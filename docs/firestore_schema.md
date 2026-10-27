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
| `errorLogs` | an ERD-free collection §1 lists as [ADDED] | client-written, open-create | D8, D10, D17 |
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
  └─ inventory/{bloodType}                           ← doc ID = blood type (enforces UK hospital+bloodType)
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
auditBlocks/{blockId}                                (server-only, append-only)
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
| Blood_Inventory | `hospitals/{id}/inventory/{bloodType}` | Unique per hospital+bloodType |
| Inventory_Logs | `hospitals/{id}/inventory/{bt}/logs/{id}` | Child of an inventory row |
| System_Config | `systemConfig/global` | Singleton in practice — the app only ever writes `global`; the rules match `{configId}` |
| Radius_Tiler (sic) | embedded in `systemConfig/global.radiusTiers[]` | Small ordered list, always read with config |
| Data_Subject_Request | `dataSubjectRequests/{id}` | Top-level |
| Audit_Block | `auditBlocks/{id}` | Top-level, server-only |
| *(no ERD table)* | `errorLogs/{id}` | [ADDED] Client error records, create-only (D8, D10, D17) |

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
| ~~hashedPassword~~ | – | – | **[DECISION]** Do NOT store. Firebase Auth manages credentials. See §9 |
| geohash | string | O | Geohash of the user's location, for proximity queries |
| latitude | number | O | |
| longitude | number | O | |
| city | string | O | City name; what makes a donor matchable without coordinates |
| lastDonationAt | Timestamp | O | Used for eligibility interval checks. Owner-frozen (D14) |
| bloodType | string | O | `BloodType`. ERD `?` |
| dateOfBirth | Timestamp | R | |
| ~~eligibilityInfo~~ | – | – | **Removed from the model of record** (D25). The ERD's field was never implemented and eligibility is computed, not stored |
| ~~isVerified~~ | – | – | **[DECISION]** Do NOT store. Firebase Auth owns email verification (`user.emailVerified`); a copy would need a writer to stay true. See D5 |
| status | string | R | `Active \| Suspended \| Removed`. Admin-writable (FR-040) |
| statusReason | string | O | Admin reason recorded when suspending (D26); cleared on reactivate |
| statusUpdatedAt | Timestamp | O | Set when status changes (D26) |
| createdAt | Timestamp | R | |

Role/hospital claims: also set Firebase Auth **custom claims** `{ role, hospitalId }` for security rules **[ADDED]**.

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
| name | string | R | |
| address | string | R | |
| latitude | number | R | |
| longitude | number | R | |
| geohash | string | R | **[ADDED]** needed for proximity search |
| contactNumber | string | R | |
| status | string | R | `Active \| Suspended \| Removed` |

#### 2.3.1 `hospitals/{hospitalId}/subscriptions/{subscriptionId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| plan | string | R | Plan values not specified in ERD |
| startDate | Timestamp | R | |
| endDate | Timestamp | R | |
| status | string | R | `Active \| Suspended \| Removed` (as in ERD, see §9) |

(`hospitalId` is implied by the path. Also write it as a field if you want collection-group queries **[ADDED]**.)

#### 2.3.2 `hospitals/{hospitalId}/inventory/{bloodType}`

Doc ID **is** the blood type, so UK(hospital_id, blood_type) is guaranteed.

| Field | Type | R/O | Notes |
|---|---|---|---|
| bloodType | string | R | Same as doc ID |
| unitsAvailable | number (int) | R | Update only via transaction / increment |
| lastUpdated | Timestamp | R | |

#### 2.3.3 `hospitals/{hospitalId}/inventory/{bloodType}/logs/{logId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| donationId | string | O | FK → `donations`. Null for manual adjustments / usage |
| userId | string | R | FK → `users`, who made the change |
| changeType | string | R | Values not in ERD. Suggested: `Donation \| Usage \| Adjustment \| Expired` |
| unitsChanged | number (int) | R | Positive or negative |
| createdAt | Timestamp | R | |

Write the log and the inventory update in **one transaction/batch**.

### 2.4 `bloodRequests/{requestId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| recipientId | string | O | FK → `users` (ERD `?`) |
| hospitalId | string | R | FK → `hospitals` |
| createdBy | string | O | FK → `users` (ERD `?`) |
| bloodType | string | R | `BloodType` |
| component | string | R | FK → `donationTypes/{id}` — `whole-blood \| rbc \| platelets \| plasma \| cryoprecipitate`. **[ADDED]** (D24) |
| quantity | number (int) | R | Units needed |
| urgencyLevel | string | R | `urgent \| stat \| routine` — the `.chip[data-priority]` tones the UI renders (D24) |
| status | string | R | `urgent \| collecting \| matched \| fulfilled \| cancelled` — the shipped `.chip[data-status]` set (D24). The ERD's `Active \| Suspended \| Removed` was a copy-paste error (see §9) |
| createdAt | Timestamp | R | |
| hospitalName, latitude, longitude, geohash | string / number | R | **[ADDED, denormalized]** copied from the hospital at creation, so matching by radius needs no extra read |

> Note: `urgent` appears in **both** `status` and `urgencyLevel`. That is the
> shipped vocabulary, not an accident to normalise away (D24) — an urgent request
> is also urgent priority.

### 2.5 `donorMatches/{requestId}_{donorId}`

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
| sentAt | Timestamp | O | Null until sent |

### 2.9 `donations/{matchId}`

Doc ID = the `donorMatches` doc ID. One donation per match (ERD 1:1).

| Field | Type | R/O | Notes |
|---|---|---|---|
| matchId | string | R | Same as doc ID |
| confirmedBy | string | R | FK → `users` (staff) |
| donationDate | Timestamp | R | |
| units | number (int) | R | |
| confirmedAt | Timestamp | R | |
| donorId, hospitalId, bloodType | string | R | **[ADDED, denormalized]** from the match/request. ERD has no donorId on Donations, only via match |

### 2.10 `rewardTransactions/{donationId}`

Doc ID = `donationId` so UK(donation_id) holds.

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
| updatedBy | string | R | FK → `users` (Admin) |
| notifRetryLimit | number (int) | R | Max retries per notification |
| notifRetryInterval | number | R | Unit unspecified. **[DECISION]** minutes |
| radiusTiers | array of map | R | See below |
| updatedAt | Timestamp | R | |

`radiusTiers[]` item (ERD `Radius_Tiler`; `tier_id` and `config_id` dropped as redundant):

| Field | Type | Notes |
|---|---|---|
| tierOrder | number (int) | 1 = searched first |
| radiusKm | number | Search radius |
| waitMinutes | number | Wait before expanding to the next tier |

Keep the array sorted by `tierOrder`.

### 2.12 `dataSubjectRequests/{dsrId}`

| Field | Type | R/O | Notes |
|---|---|---|---|
| userId | string | R | FK → `users` |
| processedBy | string | O | `users` id of the admin (ERD has no FK marker. See §9) |
| requestType | string | R | Suggested: `Access \| Erasure \| Rectification \| Export` |
| status | string | R | Suggested: `Pending \| InProgress \| Completed \| Rejected` |
| adminNote | string | O | [ADDED] Admin note/summary of manual export/erasure action (D26) |
| createdAt | Timestamp | R | |
| resolvedAt | Timestamp | O | ERD `?` |

### 2.13 `auditBlocks/{blockId}` — server-only, append-only

Hash-chained audit log. **Never update or delete.**

| Field | Type | R/O | Notes |
|---|---|---|---|
| prevHash | string | R | `recordHash` of the previous block (genesis block: `"0"`) |
| recordHash | string | R | **UK**. Use as doc ID, or check in transaction |
| eventType | string | R | |
| hashedEntityRef | string | R | Hash of the affected entity ID, never the raw ID |
| hashedActorRef | string | R | Hash of the actor ID, never the raw ID |
| createdAt | Timestamp | R | |
| sequence | number (int) | R | **[ADDED]** monotonically increasing, assigned in a transaction reading the last block. Firestore has no auto-increment |

---

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
| collection group `logs` | `createdAt` DESC | Cross-hospital inventory audit |

TTL policy: `emailVerifications.expiresAt`.

---

## 5. Where the agent must use transactions / server logic

1. **Registering a user**: create Firebase Auth user, then `users/{uid}`, then set custom claims.
2. **Creating a match**: use the deterministic ID `{requestId}_{donorId}`. Fail if it exists.
3. **Confirming a donation**: in ONE transaction: create `donations/{matchId}`, create `rewardTransactions/{donationId}`, increment `hospitals/{h}/inventory/{bt}.unitsAvailable`, write an inventory `logs` doc, set `users/{donorId}.lastDonationAt`.
4. **Inventory changes**: always `FieldValue.increment()` or a transaction. Never read-then-write.
5. **Audit blocks**: create in a transaction that reads the latest block (by `sequence`), sets `prevHash`, computes `recordHash`.
6. **Notification retries**: Cloud Function / scheduler reads `systemConfig/global` for `notifRetryLimit` and `notifRetryInterval`.
7. **Radius expansion**: scheduler walks `radiusTiers` in `tierOrder`, waiting `waitMinutes` between tiers, querying donors via geohash ranges.
8. **Eligibility check**: `now - users.lastDonationAt >= donationTypes.intervalDays`.

---

## 6. Security rules outline

Use custom claims `request.auth.token.role` and `request.auth.token.hospitalId`.

| Collection | Read | Write |
|---|---|---|
| `users/{uid}` | Owner; Admin; Staff of same hospital (limited) | Owner (non-privileged fields only: not `role`, `status`, `isVerified`); Admin |
| `emailVerifications` | none | server-only |
| `hospitals` | Authenticated | Staff of that hospital (limited), Admin |
| `hospitals/*/subscriptions` | Staff of that hospital, Admin | Admin / server |
| `hospitals/*/inventory` + `logs` | Staff of that hospital, Admin | Staff of that hospital, Admin (via function preferred) |
| `bloodRequests` | Authenticated | Create: Recipient / Staff. Update status: Staff of hospital, Admin |
| `donorMatches` | Donor (own), Staff of request's hospital, Admin | Donor may update only `responseStatus`, `guidelinesAcknowledged`, `acknowledgedAt`; Staff update screening fields; creation server-only |
| `donorConsents` | Donor (own), Admin | Donor create / set `revokedAt` only. No delete |
| `donationTypes` + `guidelines` | Authenticated | Admin |
| `notifications` | Owner | server-only |
| `donations` | Donor (own), Staff of hospital, Admin | Staff / server only |
| `rewardTransactions` | Donor (own), Admin | server-only |
| `systemConfig` | Admin (Authenticated may read tiers if needed) | Admin |
| `dataSubjectRequests` | Owner, Admin | Owner create; Admin update |
| `auditBlocks` | Admin | server-only, no update/delete |

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

interface InventoryItem {            // hospitals/{h}/inventory/{bloodType}
  bloodType: BloodType;
  unitsAvailable: number;
  lastUpdated: Timestamp;
}

interface InventoryLog {             // .../inventory/{bt}/logs/{id}
  donationId?: string | null;
  userId: string;
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
  requestType: string;
  status: string;
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

---

## 9. Open questions / ERD inconsistencies (agent: flag, don't guess)

> **Answered:** 2 (requests — D24; subscriptions still open), 5's `urgencyLevel` (D24), 6 (D25).
> The rest are open and re-stated in `docs/PHASES.md` §10.

1. **Passwords and verification**: ERD stores `hashed_password` and an `Email_Verification` table. With Firebase Auth both are normally handled by Auth. I omitted `hashedPassword` and kept `emailVerifications` in case you use custom OTP codes. Confirm.
2. **Copy-pasted status enum**: `Blood_Requests.status` and `Subscriptions.status` show `Active, Suspended, Removed` like Users/Hospitals. **Answered for requests:** the build's set is `urgent | collecting | matched | fulfilled | cancelled` (D24). **Still open for subscriptions**: `Active | Expired | Cancelled` is the suggestion, not a decision.
3. **Missing FK edges in the diagram**: `Hospitals.created_by`, `Donor_Matches.screened_by_user_id`, `Donations.confirmed_by`, `Data_Subject_Request.processed_by`, `Blood_Requests.created_by` — all assumed → `users`.
4. **`Donations` has no `donor_id`** — derived via match. I added `donorId`, `hospitalId`, `bloodType` as denormalized fields.
5. **Unspecified enum values** (suggested values given above): `urgencyLevel` **answered** — `urgent | stat | routine` (D24). Still open: `responseStatus`, `consentType`, `channel`, `deliveryStatus`, `changeType`, `requestType`, DSR `status`, subscription `plan`.
6. **`eligibility_info`** type unknown. **Answered (D25):** the field was never implemented, eligibility is computed on read, and it was removed from the model of record. If a screening record is ever needed, it gets a purpose-designed field in that feature.
7. **`notif_retry_interval`** unit unknown. Assumed minutes.
8. **Radius_Tiler** is spelled "Tiler" in the ERD; treated as "Tiers".
9. **Embedding vs. collection** for radius tiers and guidelines: chosen for read efficiency. If admins need to edit tiers individually with history, make them subcollections instead.
10. **Privacy**: this stores health-related personal data and has a Data Subject Request table, so a data-protection law (e.g. GDPR / Philippine Data Privacy Act) likely applies. Erasure requests must be reconciled with append-only audit blocks (hence the hashed refs).
