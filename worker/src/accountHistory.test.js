import test from "node:test";
import assert from "node:assert/strict";
import { getAccountHistory } from "./accountHistory.js";
import { hashRef } from "./audit.js";
const env = { AUDIT_HASH_SECRET: "history-test-only" };
async function fixture({
  count = 2,
  tombstone = false,
  mismatch = false,
  legacy = false,
} = {}) {
  const actor = await hashRef(env, "admin");
  const subject = await hashRef(env, "donor");
  const context = {
    afterStatus: "Suspended",
    beforeStatus: "Active",
    reason: "Facility request",
  };
  const digest = await hashRef(env, JSON.stringify(context));
  const queries = [],
    reads = [];
  const adapter = {
    getDocument: async (collection, id) => {
      reads.push([collection, id]);
      if (collection === "users") return { id, data: {} };
      if (collection === "auditContexts")
        return {
          data: {
            ...context,
            reason: mismatch ? "tampered" : context.reason,
            secret: "must-not-return",
          },
        };
      if (collection === "auditRedactions" && tombstone && id === actor)
        return { data: { state: "Pending" } };
      return null;
    },
    runQuery: async (query) => {
      queries.push(query);
      if (query.from[0].collectionId === "users")
        return [
          {
            id: "admin",
            data: {
              fullName: "Admin",
              email: "admin@example.test",
              privateValue: "must-not-return",
            },
          },
        ];
      return Array.from({ length: count }, (_, i) => ({
        id: `block-${i}`,
        data: {
          sequence: 100 - i,
          entityType: "user",
          eventType: "Account.Suspended",
          hashedEntityRef: subject,
          hashedActorRef: actor,
          ...(legacy ? {} : { contextHash: digest }),
        },
      }));
    },
  };
  return { adapter, queries, reads };
}
test("history validates subject and cursor before reading, and fails closed without a hash secret", async () => {
  const { adapter, reads } = await fixture();
  for (const [id, cursor] of [
    [null, null],
    ["bad/id", null],
    ["donor", "-1"],
    ["donor", "1.5"],
    ["donor", "99999999999999999"],
  ])
    await assert.rejects(getAccountHistory(env, id, cursor, adapter), {
      status: 400,
    });
  await assert.rejects(getAccountHistory({}, "donor", null, adapter), {
    status: 503,
  });
  assert.equal(reads.length, 0);
});
test("history query is account-scoped, cursor-bound and limited, and returns whitelisted verified context only", async () => {
  const { adapter, queries } = await fixture();
  const result = await getAccountHistory(env, "donor", "90", adapter);
  assert.equal(queries[0].limit, 26);
  const filters = queries[0].where.compositeFilter.filters;
  assert.equal(
    filters[0].fieldFilter.value.stringValue,
    await hashRef(env, "donor"),
  );
  assert.equal(filters[1].fieldFilter.value.stringValue, "user");
  assert.equal(filters[2].fieldFilter.value.integerValue, "90");
  assert.equal(result.events[0].contextState, "verified");
  assert.equal(result.events[0].actor.fullName, "Admin");
  assert.equal(JSON.stringify(result).includes("must-not-return"), false);
  assert.equal("hashedActorRef" in result.events[0], false);
});
test("history pagination returns 25 records and an exclusive continuation sequence", async () => {
  const { adapter } = await fixture({ count: 26 });
  const result = await getAccountHistory(env, "donor", null, adapter);
  assert.equal(result.events.length, 25);
  assert.equal(result.nextBefore, 76);
});
test("a pending erasure tombstone hides private context and actor identity immediately", async () => {
  const { adapter } = await fixture({ tombstone: true });
  const result = await getAccountHistory(env, "donor", null, adapter);
  assert.equal(result.events[0].context, null);
  assert.equal(result.events[0].actor, null);
  assert.equal(result.events[0].contextState, "redacted");
});
test("tampered context is not displayed and legacy history remains explicit about missing context", async () => {
  const bad = await fixture({ mismatch: true });
  const result = await getAccountHistory(env, "donor", null, bad.adapter);
  assert.equal(result.events[0].context, null);
  assert.equal(result.events[0].contextState, "mismatch");
  const old = await fixture({ legacy: true });
  const legacy = await getAccountHistory(env, "donor", null, old.adapter);
  assert.equal(legacy.events[0].contextState, "not-recorded");
});
