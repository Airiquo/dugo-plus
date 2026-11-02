import { getDocument, runQuery } from "./firestore.js";
import { hashRef } from "./audit.js";
import { HttpError } from "./http.js";

const PAGE_SIZE = 25;
const fields = ["afterStatus", "beforeStatus", "reason"];

/** Bounded account history. Access is checked by the HTTP route before calling. */
export async function getAccountHistory(
  env,
  accountId,
  before = null,
  adapter = {},
) {
  if (typeof accountId !== "string" || !/^[^/\s]{1,128}$/.test(accountId))
    throw new HttpError(400, "Choose a valid account ID.");
  if (
    before !== null &&
    (!/^\d{1,16}$/.test(String(before)) ||
      !Number.isSafeInteger(Number(before)) ||
      Number(before) < 1)
  )
    throw new HttpError(400, "Invalid history cursor.");
  if (!env.AUDIT_HASH_SECRET)
    throw new HttpError(
      503,
      "Account history is unavailable until the audit service is configured.",
    );
  const read =
    adapter.getDocument ||
    ((collection, id) => getDocument(env, collection, id));
  const query = adapter.runQuery || ((value) => runQuery(env, value));
  if (!(await read("users", accountId)))
    throw new HttpError(404, "Account not found.");
  const subject = await hashRef(env, accountId);
  const filters = [
    {
      fieldFilter: {
        field: { fieldPath: "hashedEntityRef" },
        op: "EQUAL",
        value: { stringValue: subject },
      },
    },
    {
      fieldFilter: {
        field: { fieldPath: "entityType" },
        op: "EQUAL",
        value: { stringValue: "user" },
      },
    },
  ];
  if (before !== null)
    filters.push({
      fieldFilter: {
        field: { fieldPath: "sequence" },
        op: "LESS_THAN",
        value: { integerValue: String(before) },
      },
    });
  const rows = await query({
    from: [{ collectionId: "auditBlocks" }],
    where: { compositeFilter: { op: "AND", filters } },
    orderBy: [{ field: { fieldPath: "sequence" }, direction: "DESCENDING" }],
    limit: PAGE_SIZE + 1,
  });
  // Resolve current administrators only, with a fixed upper bound. Missing identities stay unavailable.
  const admins = rows.length
    ? await query({
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "role" },
            op: "EQUAL",
            value: { stringValue: "admin" },
          },
        },
        limit: 100,
      })
    : [];
  const identities = new Map(
    await Promise.all(
      admins.map(async (row) => [await hashRef(env, row.id), row.data]),
    ),
  );
  const redactions = new Map();
  async function redacted(ref) {
    if (!ref) return false;
    if (!redactions.has(ref))
      redactions.set(ref, read("auditRedactions", ref).then(Boolean));
    return redactions.get(ref);
  }
  const events = await Promise.all(
    rows.slice(0, PAGE_SIZE).map(async (row) => {
      const block = row.data;
      const detail = block.contextHash
        ? await read("auditContexts", row.id)
        : null;
      const hidden =
        (await redacted(block.hashedEntityRef)) ||
        (await redacted(block.hashedActorRef));
      let context = null;
      let contextState = hidden
        ? "redacted"
        : !block.contextHash
          ? "not-recorded"
          : "unavailable";
      if (!hidden && detail) {
        const safe = Object.fromEntries(
          fields.map((key) => [key, String(detail.data[key] || "")]),
        );
        const digest = await hashRef(env, JSON.stringify(safe));
        contextState = digest === block.contextHash ? "verified" : "mismatch";
        if (contextState === "verified") context = safe;
      }
      const actor = identities.get(block.hashedActorRef);
      const actorHidden = await redacted(block.hashedActorRef);
      return {
        id: row.id,
        sequence: block.sequence,
        eventType: block.eventType,
        createdAt: block.createdAt,
        context,
        contextState,
        actor:
          actor && !actorHidden && !actor.personalDataErased
            ? { fullName: actor.fullName || "", email: actor.email || "" }
            : null,
      };
    }),
  );
  return {
    historyVersion: 1,
    events,
    nextBefore: rows.length > PAGE_SIZE ? events.at(-1).sequence : null,
  };
}
