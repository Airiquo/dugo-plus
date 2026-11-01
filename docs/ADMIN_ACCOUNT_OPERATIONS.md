# Admin account operations — batch 1 (D40)

Branch: `fix/admin-audit-recording`. Scope: F9 account mutations and their F10
account/erasure events. Accounts layout, account-history presentation, and the
remaining admin screen redesigns belong to later batches.

## Runtime contract

`POST /accounts` requires a verified Firebase session, the `admin` custom claim,
and an existing Active admin profile. The server derives the actor from the
verified session. It rejects self-management, changes to another administrator,
invalid transitions, missing reasons, restoration after erasure, and restoration
when the Auth login no longer exists (including legacy deleted logins).

The browser checks `action: capabilities` (`accountOperationsVersion: 2`) before
submitting changes. There is no browser/callable mutation fallback. An unavailable
or older server leaves the form editable and reports failure rather than applying
an unlogged change. This deliberately supersedes D34's browser provisioning path.

Each mutation carries an `operationId` (16–80 alphanumeric/dash characters).
The browser retains only this random ID under a digest of actor/action/input in
session storage, with a memory fallback. Passwords, tokens, emails and reasons
are never persisted by that retry mechanism. Changing the password does not
change the operation identity. Changing non-secret input starts a different
operation. The server binds the ID to the actor and a keyed request digest;
reusing an ID with different details is rejected.

`state: Completed` means the account mutation completed. `auditRecorded: false`
means its event is durably queued, not lost. `state: Pending` must not be shown as
success. The browser preserves its retry ID on pending/network/server failures.

## Durable operations

- **Hospital creation:** one transaction reserves a deterministic UID, the
  facility ID, a Suspended profile, and a Suspended facility. Provisioning creates
  a disabled Auth login with that UID, publishes staff/facility claims, enables
  the login, then atomically activates the profile/facility, completes the
  operation, and creates the audit-outbox event. Until activation the profile
  gate denies protected data. Lost responses are recovered by looking up the
  reserved UID, never by adopting an account with the same email.
- **Definitive creation rejection:** cleanup removes only documents whose
  `provisioningOperationId` still matches. There is no unconditional facility
  deletion and no rollback deletion of a possibly shared Auth login.
- **Interrupted creation:** a five-minute lease prevents overlapping recovery.
  A one-minute cron resumes known Auth logins without a password. If execution
  stopped before Auth creation, the original form must be resubmitted with its
  password; no password is stored for the scheduler.
- **Suspend/remove/restore:** one transaction changes profile status, records
  the actual previous/new status and reason, completes the operation and queues
  the audit event. Restore also checks that the Auth login exists.
- **Permanent login deletion:** only a Removed donor/hospital account qualifies.
  The transaction locks it as `loginState: Deleting`; Auth deletion is idempotent;
  completion atomically writes `Deleted`, `loginDeletedAt`, and the event.
  Restore is refused while deletion is pending and after completion.
- **Erasure:** profile scrubbing, location-mirror deletion, an audit-redaction
  tombstone, operation completion and the erasure event commit together.
  Erased profiles cannot be restored. This preserves the existing scope of
  profile erasure; it is not a complete retention/compliance implementation.

The scheduler processes at most 20 due account operations and 20 due audit events
per run. Failed work is rescheduled after one minute, without a discard limit.
Account/audit/redaction maintenance runs independently of matching failures.
Pending operations retain minimal recovery metadata; completed operations clear
free-form reasons. Unresolved provisioning ownership changes require manual
operator review rather than overwriting records.

## Audit data and erasure

An account event stores event type, affected/actor HMAC references, occurrence
time and an optional `contextHash` in the immutable chain. New optional hashes
are included only when present, preserving legacy block verification. Reasons
and before/after status live in server-only `auditContexts`, outside the chain.
A future authorized account-history endpoint can resolve current user identities;
no name/email snapshot is added to the immutable chain.

Appending a block, its erasable context, the chain head, and the outbox
acknowledgement is one Firestore transaction. Concurrent/repeated delivery reads
the acknowledged outbox record and creates no second block. Delivered outbox
records retain only state, record hash and delivery time; raw references/reasons
are removed. Direct client appends cannot forge account/erasure events.

Erasure tombstones immediately prevent new context for a redacted subject or
actor. The redaction worker deletes old context in bounded pages (up to 100
subject matches and 100 actor matches for each of five jobs per run). The chain
is retained and remains verifiable. Tombstones stay after processing. New
collections deny every client read/write, including admin browsers; server IAM
performs the operations. Account access/provisioning fields are server-owned in
rules, including presence/removal checks.

## Verification and release

- `npm run test:matching`: 64 passing operation, retry-client, hash, and matching tests.
- `npm run test:rules`: 181 passing client-access/server-owned-field checks.
- `npm run test:accounts:emulator`: four passing actual Firestore REST transaction/Worker
  HTTP authorization; Identity Toolkit is simulated, with all external network
  destinations rejected. No real credentials/accounts are used.
- Configured and unconfigured builds pass; compiled configured output contains the v2 guard and permanent-deletion confirmation. Docs validation passes (78 rows/39 decisions); Worker dry-run bundle passes (88.82 KiB).
- Passed local Auth/Firestore emulator browser smoke: verified sign-in, profile reload,
  save/reload, and unverified-email gate (including direct protected-route navigation). Missing configuration shows NotConfigured. Permanent deletion opens a reason confirmation; an empty reason prevents submission. Responsive confirmation buttons wrap on narrow screens. Production smoke is a separate release
  check and is not implied by emulator results.

Deploy indexes first and wait until ready, then the Worker with its existing
service-account, API-key and stable `AUDIT_HASH_SECRET` secrets, then Hosting,
then the tightened Firestore rules. The frontend refuses an older Worker. Once
rules are tightened, older browser bundles cannot perform direct account writes;
refreshing loads the compatible frontend. Do not rotate the HMAC secret without
an explicit migration of reference hashes, operation identities and tombstones.

`workers/account-service/` and `functions/` are historical implementations, not
v2-compatible deployment alternatives. No Worker/rules/index/Hosting deployment
is performed as part of this batch. Live provider IAM, Auth provisioning and the
scheduler must be smoke-tested before production activation. Hosting remains
on the owner's temporary integration-release workflow (D37).
