import { runQuery } from "./firestore.js";
import { hashRef } from "./audit.js";
import { auditDetails } from "./auditDetails.js";
import { HttpError } from "./http.js";

const PAGE_SIZE = 25;
const DIRECTORY_LIMIT = 500;
let directoryCache = null;
const eq = (fieldPath, stringValue) => ({
  fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue } },
});
const timestamp = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));

/** Admin-only, filtered activity. Cursor orders by time and sequence to avoid timestamp ties. */
export async function getAuditActivity(env, options = {}, adapter = {}) {
  if (!env.AUDIT_HASH_SECRET)
    throw new HttpError(503, "The audit service is not configured.");
  for (const key of ["account", "actor"])
    if (
      options[key] &&
      (typeof options[key] !== "string" ||
        !/^[^/\s]{1,128}$/.test(options[key]))
    )
      throw new HttpError(400, "Choose a valid account ID.");
  if (
    options.event &&
    (typeof options.event !== "string" ||
      !/^[\w.-]{1,120}$/.test(options.event))
  )
    throw new HttpError(400, "Choose a valid event type.");
  for (const key of ["from", "to"])
    if (options[key] && !timestamp(options[key]))
      throw new HttpError(400, "Choose valid dates.");
  if (
    options.from &&
    options.to &&
    Date.parse(options.from) > Date.parse(options.to)
  )
    throw new HttpError(400, "The start date must be before the end date.");
  let cursor = null;
  if (options.cursor) {
    try {
      if (typeof options.cursor !== "string" || options.cursor.length > 160)
        throw new Error();
      cursor = JSON.parse(options.cursor);
      if (
        !timestamp(cursor.time) ||
        !Number.isSafeInteger(cursor.sequence) ||
        cursor.sequence < 1
      )
        throw new Error();
    } catch {
      throw new HttpError(400, "Invalid activity cursor.");
    }
  }
  const query = adapter.runQuery || ((value) => runQuery(env, value));
  const filters = [];
  const known = new Map();
  for (const [key, field] of [
    ["account", "hashedEntityRef"],
    ["actor", "hashedActorRef"],
  ]) {
    if (!options[key]) continue;
    const hash = await hashRef(env, options[key]);
    known.set(hash, options[key]);
    filters.push(eq(field, hash));
    if (key === "account") filters.push(eq("entityType", "user"));
  }
  if (options.event) filters.push(eq("eventType", options.event));
  for (const [key, op] of [
    ["from", "GREATER_THAN_OR_EQUAL"],
    ["to", "LESS_THAN_OR_EQUAL"],
  ])
    if (options[key])
      filters.push({
        fieldFilter: {
          field: { fieldPath: "createdAt" },
          op,
          value: { timestampValue: new Date(options[key]).toISOString() },
        },
      });
  const structuredQuery = {
    from: [{ collectionId: "auditBlocks" }],
    ...(filters.length
      ? { where: { compositeFilter: { op: "AND", filters } } }
      : {}),
    orderBy: [
      { field: { fieldPath: "createdAt" }, direction: "DESCENDING" },
      { field: { fieldPath: "sequence" }, direction: "DESCENDING" },
    ],
    limit: PAGE_SIZE + 1,
    ...(cursor
      ? {
          startAt: {
            values: [
              { timestampValue: cursor.time },
              { integerValue: String(cursor.sequence) },
            ],
            before: false,
          },
        }
      : {}),
  };
  const rows = await query(structuredQuery);
  const cacheKey = `${env.FIREBASE_SERVICE_ACCOUNT || ""}\n${env.AUDIT_HASH_SECRET}`;
  let directory = [];
  if (rows.length) {
    if (
      !adapter.runQuery &&
      directoryCache?.key === cacheKey &&
      directoryCache.until > Date.now()
    )
      directory = directoryCache.ids;
    else {
      directory = (
        await query({
          from: [{ collectionId: "users" }],
          select: { fields: [{ fieldPath: "__name__" }] },
          limit: DIRECTORY_LIMIT,
        })
      ).map((row) => row.id);
      if (!adapter.runQuery)
        directoryCache = {
          key: cacheKey,
          until: Date.now() + 60000,
          ids: directory,
        };
    }
  }
  const identities = new Map(
    await Promise.all(
      directory.map(async (uid) => [await hashRef(env, uid), uid]),
    ),
  );
  for (const [hash, uid] of known) identities.set(hash, uid);
  const events = await auditDetails(
    env,
    rows.slice(0, PAGE_SIZE),
    identities,
    adapter,
  );
  const last = rows[PAGE_SIZE - 1]?.data;
  const time =
    last?.createdAt instanceof Date
      ? last.createdAt.toISOString()
      : last?.createdAt;
  return {
    activityVersion: 1,
    events,
    nextCursor:
      rows.length > PAGE_SIZE
        ? JSON.stringify({ time, sequence: last.sequence })
        : null,
    identityResolutionLimit: DIRECTORY_LIMIT,
  };
}
