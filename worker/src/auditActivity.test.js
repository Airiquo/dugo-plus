import test from "node:test";
import assert from "node:assert/strict";
import { getAuditActivity } from "./auditActivity.js";
import { hashRef } from "./audit.js";

const env = { AUDIT_HASH_SECRET: "activity-tests-only" };
async function fixture({
  count = 2,
  redacted = false,
  mismatch = false,
  legacy = false,
  erased = false,
  directory = true,
} = {}) {
  const actor = await hashRef(env, "admin"),
    subject = await hashRef(env, "donor");
  const context = {
    afterStatus: "Suspended",
    beforeStatus: "Active",
    reason: "Facility request",
  };
  const digest = await hashRef(env, JSON.stringify(context));
  const queries = [],
    batches = [];
  const adapter = {
    runQuery: async (value) => {
      queries.push(value);
      if (value.from[0].collectionId === "users")
        return directory ? [{ id: "admin" }, { id: "donor" }] : [];
      return Array.from({ length: count }, (_, i) => ({
        id: `block-${i}`,
        data: {
          sequence: 100 - i,
          createdAt: new Date("2026-11-01T12:00:00Z"),
          entityType: "user",
          eventType: "Account.Suspended",
          hashedEntityRef: subject,
          hashedActorRef: actor,
          ...(legacy ? {} : { contextHash: digest }),
        },
      }));
    },
    getDocuments: async (paths) => {
      batches.push(paths);
      return new Map(
        paths.map((path) => [
          path,
          path.startsWith("auditContexts/")
            ? {
                data: {
                  ...context,
                  reason: mismatch ? "changed" : context.reason,
                  privateValue: "NEVER-RETURN",
                },
              }
            : path === `auditRedactions/${subject}` && redacted
              ? { data: { state: "Pending" } }
              : path.startsWith("users/")
                ? {
                    data: {
                      fullName: path.slice(6),
                      email: `${path.slice(6)}@example.test`,
                      personalDataErased: erased,
                      privateValue: "NEVER-RETURN",
                    },
                  }
                : null,
        ]),
      );
    },
  };
  return { actor, subject, adapter, queries, batches };
}

test("activity rejects malformed filters/cursors and missing hash configuration before reads", async () => {
  const f = await fixture();
  for (const options of [
    { account: "bad/id" },
    { actor: "bad id" },
    { event: "bad event" },
    { from: "yesterday" },
    { from: "2026-11-02T00:00:00Z", to: "2026-11-01T00:00:00Z" },
    { cursor: "{}" },
    { cursor: JSON.stringify({ time: "2026-11-01T00:00:00Z", sequence: 0 }) },
  ])
    await assert.rejects(getAuditActivity(env, options, f.adapter), {
      status: 400,
    });
  await assert.rejects(getAuditActivity({}, {}, f.adapter), { status: 503 });
  assert.equal(f.queries.length, 0);
});
test("activity combines full-history filters and applies an exclusive timestamp/sequence cursor", async () => {
  const f = await fixture({ count: 26 });
  const cursor = JSON.stringify({ time: "2026-11-01T12:00:00Z", sequence: 90 });
  const result = await getAuditActivity(
    env,
    {
      account: "donor",
      actor: "admin",
      event: "Account.Suspended",
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-02T00:00:00Z",
      cursor,
    },
    f.adapter,
  );
  const query = f.queries[0];
  assert.equal(query.limit, 26);
  assert.equal(query.where.compositeFilter.filters.length, 6);
  assert.deepEqual(query.startAt, {
    values: [
      { timestampValue: "2026-11-01T12:00:00Z" },
      { integerValue: "90" },
    ],
    before: false,
  });
  assert.equal(result.events.length, 25);
  assert.deepEqual(JSON.parse(result.nextCursor), {
    time: "2026-11-01T12:00:00.000Z",
    sequence: 76,
  });
  assert.equal(f.queries[1].limit, 500);
  assert.deepEqual(f.queries[1].select.fields, [{ fieldPath: "__name__" }]);
});
test("activity returns current identities and only whitelisted digest-verified private details", async () => {
  const f = await fixture();
  const result = await getAuditActivity(env, {}, f.adapter);
  assert.equal(result.events[0].affectedAccount.fullName, "donor");
  assert.equal(result.events[0].actor.fullName, "admin");
  assert.equal(result.events[0].contextState, "verified");
  assert.equal(result.events[0].context.reason, "Facility request");
  assert.equal(JSON.stringify(result).includes("NEVER-RETURN"), false);
  assert.equal(f.batches.length, 1);
});
test("erasure tombstones suppress identity and context immediately, and erased profiles stay unavailable", async () => {
  const f = await fixture({ redacted: true });
  const result = await getAuditActivity(env, {}, f.adapter);
  assert.equal(result.events[0].contextState, "redacted");
  assert.equal(result.events[0].context, null);
  assert.equal(result.events[0].affectedAccount, null);
  const erased = await fixture({ erased: true });
  assert.equal(
    (await getAuditActivity(env, {}, erased.adapter)).events[0].actor,
    null,
  );
});
test("mismatched and legacy context is withheld, and unresolved identity is explicit", async () => {
  const f = await fixture({ mismatch: true });
  const bad = (await getAuditActivity(env, {}, f.adapter)).events[0];
  assert.equal(bad.contextState, "mismatch");
  assert.equal(bad.context, null);
  const old = await fixture({ legacy: true, directory: false });
  const result = (await getAuditActivity(env, {}, old.adapter)).events[0];
  assert.equal(result.contextState, "not-recorded");
  assert.equal(result.affectedAccount, null);
});
test("explicit account IDs resolve beyond the bounded directory without returning other profiles", async () => {
  const f = await fixture({ directory: false });
  const result = await getAuditActivity(env, { account: "donor" }, f.adapter);
  assert.equal(result.events[0].affectedAccount.fullName, "donor");
  assert.equal(result.events[0].actor, null);
});
