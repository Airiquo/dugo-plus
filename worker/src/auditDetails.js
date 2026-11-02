import { getDocuments } from "./firestore.js";
import { hashRef } from "./audit.js";

/** Resolve current identities and authenticated, erasable context in bounded reads. */
export async function auditDetails(env, rows, identities, adapter = {}) {
  const paths = new Set();
  for (const { id, data: block } of rows) {
    if (block.contextHash) paths.add(`auditContexts/${id}`);
    for (const ref of [block.hashedEntityRef, block.hashedActorRef]) {
      if (!ref) continue;
      paths.add(`auditRedactions/${ref}`);
      const uid = identities.get(ref);
      if (uid) paths.add(`users/${uid}`);
    }
  }
  const readMany =
    adapter.getDocuments ||
    (adapter.getDocument
      ? async (paths) =>
          new Map(
            await Promise.all(
              paths.map(async (path) => {
                const [collection, id] = path.split("/");
                return [path, await adapter.getDocument(collection, id)];
              }),
            ),
          )
      : (paths) => getDocuments(env, paths));
  const documents = await readMany([...paths]);
  const hidden = (ref) => !!documents.get(`auditRedactions/${ref}`);
  const person = (ref) => {
    const uid = identities.get(ref);
    const profile = documents.get(`users/${uid}`)?.data;
    if (!profile || profile.personalDataErased || hidden(ref)) return null;
    return {
      id: uid,
      fullName: profile.fullName || "",
      email: profile.email || "",
      role: profile.role || "",
    };
  };
  return Promise.all(
    rows.map(async ({ id, data: block }) => {
      const erased =
        hidden(block.hashedEntityRef) || hidden(block.hashedActorRef);
      const detail = documents.get(`auditContexts/${id}`)?.data;
      let context = null;
      let contextState = erased
        ? "redacted"
        : !block.contextHash
          ? "not-recorded"
          : "unavailable";
      if (!erased && block.contextHash && detail) {
        const safe = Object.fromEntries(
          ["afterStatus", "beforeStatus", "reason"].map((key) => [
            key,
            String(detail[key] || ""),
          ]),
        );
        contextState =
          (await hashRef(env, JSON.stringify(safe))) === block.contextHash
            ? "verified"
            : "mismatch";
        if (contextState === "verified") context = safe;
      }
      return {
        id,
        sequence: block.sequence,
        eventType: block.eventType,
        entityType: block.entityType,
        createdAt: block.createdAt,
        actorRole: block.actorRole,
        correctsBlockId: block.correctsBlockId || null,
        recordHash: block.recordHash,
        prevHash: block.prevHash,
        hashedEntityRef: block.hashedEntityRef,
        hashedActorRef: block.hashedActorRef,
        contextState,
        context,
        actor: person(block.hashedActorRef),
        affectedAccount:
          block.entityType === "user" ? person(block.hashedEntityRef) : null,
      };
    }),
  );
}
