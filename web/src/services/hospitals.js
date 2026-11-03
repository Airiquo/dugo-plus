import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { BLOOD_TYPES } from "./users";
import { inventoryKey } from "../utils/inventory";
export { screenDonorMatch } from "./inventory";

/**
 * Facility documents — `hospitals/{hospitalId}` (schema §2.3) — plus the
 * facility's reads: stock (`hospitals/{hospitalId}/inventory`, §2.3.2), the
 * donation log's pending matches (`donorMatches`, §2.5) and confirmed
 * donations (`donations`, §2.9), FR-020.
 *
 * Hospital staff read their own facility through this module and update the
 * name/contact fields the rules allow. `status` and `createdBy` are not
 * writable here: status is an admin action and the creator is set at intake.
 * Inventory writes use the authenticated Worker through `services/inventory.js`
 * (FR-034, D63).
 */

const NOT_CONFIGURED =
  "Firestore is not available. Copy web/.env.example to web/.env.local.";

/** Firestore's local copy of the document; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED);
}

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function num(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read a facility document.
 *
 * @param {string} hospitalId - the account's `users.hospitalId`
 * @returns {Promise<{
 *   id: string, name: string, address: string, latitude: number, longitude: number,
 *   geohash: string, contactNumber: string, status: string,
 * } | null>} null when the account has no facility or the document is missing.
 */
export async function readHospital(hospitalId) {
  requireDb();
  const id = text(hospitalId);
  if (!id) return null;
  const snap = await getDoc(doc(db, "hospitals", id));
  if (!snap.exists()) return null;
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    name: text(data.name),
    address: text(data.address),
    latitude: num(data.latitude),
    longitude: num(data.longitude),
    geohash: text(data.geohash),
    contactNumber: text(data.contactNumber),
    status: text(data.status),
  };
}

/** Alias for readHospital used by donor/map components (FR-023). */
export const getHospital = readHospital;

/** Save the staff-editable facility name/contact; address and location remain admin-managed. */
export async function saveHospital(hospitalId, changes = {}) {
  requireDb();
  const id = text(hospitalId);
  if (!id) throw new Error("This account is not linked to a facility.");

  const data = {};
  if ("name" in changes) data.name = text(changes.name);
  if ("contactNumber" in changes)
    data.contactNumber = text(changes.contactNumber);

  if (!Object.keys(data).length) return;
  await updateDoc(doc(db, "hospitals", id), data);
}

/** A readable timestamp, or null for anything Firestore has not written yet. */
function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return null;
}

/** The eight blood types, in display order, missing documents as zero. */
function stockRows(snap, component) {
  const found = new Map();
  const legacy = new Map();
  snap.forEach((item) => {
    const data = item.data() ?? {};
    const bloodType = BLOOD_TYPES.includes(data.bloodType)
      ? data.bloodType
      : item.id;
    if (!BLOOD_TYPES.includes(bloodType)) return;
    if (!data.component) {
      legacy.set(
        bloodType,
        Math.max(0, Math.trunc(Number(data.unitsAvailable) || 0)),
      );
      return;
    }
    if (
      data.component !== component ||
      item.id !== inventoryKey(component, bloodType)
    )
      return;
    found.set(bloodType, {
      bloodType,
      unitsAvailable: Math.max(0, Math.trunc(Number(data.unitsAvailable) || 0)),
      lastUpdated: asDate(data.lastUpdated),
    });
  });
  return BLOOD_TYPES.map((bloodType) => ({
    ...(found.get(bloodType) ?? {
      bloodType,
      unitsAvailable: 0,
      lastUpdated: null,
    }),
    component,
    unclassifiedUnits: legacy.get(bloodType) || 0,
  }));
}

/** One `donations` document, shaped for a history row (FR-020). */
function donationRow(snap) {
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    hospitalId: text(data.hospitalId),
    donorId: typeof data.donorId === "string" ? data.donorId : "",
    donorName: typeof data.donorName === "string" ? data.donorName : "",
    bloodType: typeof data.bloodType === "string" ? data.bloodType : "",
    component: text(data.component),
    donationType:
      typeof data.donationType === "string" ? data.donationType : "",
    requestId: typeof data.requestId === "string" ? data.requestId : "",
    units: Math.trunc(Number(data.units) || 0),
    donationDate: asDate(data.donationDate),
  };
}

/**
 * Read the facility's stock once: one row per blood type, types without a
 * document reading as zero (FR-020).
 *
 * @param {string} hospitalId
 * @returns {Promise<Array<{bloodType: string, unitsAvailable: number, lastUpdated: Date|null}>>}
 */
export async function getInventory(hospitalId, component = "whole-blood") {
  requireDb();
  const id = text(hospitalId);
  if (!id)
    return BLOOD_TYPES.map((bloodType) => ({
      bloodType,
      unitsAvailable: 0,
      lastUpdated: null,
    }));
  const snap = await getDocs(collection(db, "hospitals", id, "inventory"));
  return stockRows(snap, component);
}

/**
 * Follow the facility's stock with live updates (FR-020). Fires once with the
 * current rows, then on every change.
 *
 * @param {string} hospitalId
 * @param {(rows: Array<{bloodType: string, unitsAvailable: number, lastUpdated: Date|null}>) => void} onNext
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function watchInventory(
  hospitalId,
  onNext,
  onError,
  component = "whole-blood",
) {
  requireDb();
  const id = text(hospitalId);
  if (!id) {
    onNext(
      BLOOD_TYPES.map((bloodType) => ({
        bloodType,
        unitsAvailable: 0,
        lastUpdated: null,
      })),
    );
    return () => {};
  }
  return onSnapshot(
    collection(db, "hospitals", id, "inventory"),
    (snap) => onNext(stockRows(snap, component)),
    onError,
  );
}

/**
 * One `donorMatches` document, shaped for the donation log (schema §2.5).
 * The request supplies facility/component; the matcher may supply a donor-group
 * snapshot. Confirmation always resolves the actual donor group server-side.
 */
function matchRow(snap, request) {
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    requestId: request.id,
    donorId: typeof data.donorId === "string" ? data.donorId : "",
    hospitalId: request.hospitalId,
    bloodType: text(data.donorBloodType),
    requestedBloodType: request.bloodType,
    component: request.component,
    donationTypeId:
      typeof data.donationTypeId === "string" ? data.donationTypeId : "",
    responseStatus:
      typeof data.responseStatus === "string" ? data.responseStatus : "",
    screeningStatus:
      typeof data.screeningStatus === "string" ? data.screeningStatus : "",
    guidelinesAcknowledged: data.guidelinesAcknowledged === true,
    matchedAt: asDate(data.matchedAt),
  };
}

/**
 * All the facility's donor matches, newest first — the donation log's pending
 * rows (FR-020, FR-034).
 *
 * Matches do not carry a hospital (schema §2.5) and the rules only let staff
 * read a match through its request's hospital, so this goes request-first:
 * the facility's requests, then each request's matches with an equality
 * query on `requestId`, which the rules can evaluate. Both reads use
 * single-field equality filters, so no composite index is needed; ordering
 * happens here.
 *
 * @param {string} hospitalId
 * @returns {Promise<Array<ReturnType<typeof matchRow>>>}
 */
export async function getFacilityMatches(hospitalId) {
  requireDb();
  const id = text(hospitalId);
  if (!id) return [];

  const requestSnap = await getDocs(
    query(collection(db, "bloodRequests"), where("hospitalId", "==", id)),
  );
  const requests = requestSnap.docs
    .map((item) => {
      const data = item.data() ?? {};
      return {
        id: item.id,
        hospitalId: id,
        bloodType: text(data.bloodType),
        component: text(data.component),
        createdAt: asDate(data.createdAt)?.getTime() ?? 0,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const groups = await Promise.all(
    requests.map(async (request) => {
      const snap = await getDocs(
        query(
          collection(db, "donorMatches"),
          where("requestId", "==", request.id),
        ),
      );
      return snap.docs.map((item) => matchRow(item, request));
    }),
  );

  return groups
    .flat()
    .sort(
      (a, b) => (b.matchedAt?.getTime() ?? 0) - (a.matchedAt?.getTime() ?? 0),
    );
}

/**
 * Every facility, id + name — the admin facility picker (FR-020). Any signed
 * session may list them: donors need the same list for the map (schema §6).
 *
 * @returns {Promise<Array<{id: string, name: string}>>} sorted by name
 */
export async function listHospitals() {
  requireDb();
  const snap = await getDocs(collection(db, "hospitals"));
  return snap.docs
    .map((item) => ({ id: item.id, name: text(item.data()?.name) || item.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The facility's donation history, newest first (FR-014, FR-020).
 *
 * @param {string} hospitalId
 * @param {{ since?: Date | number | null, until?: Date | number | null, cursor?: import('firebase/firestore').DocumentSnapshot | null, limit?: number }} [options]
 * @returns {Promise<{ rows: Array<ReturnType<typeof donationRow>>,
 *   cursor: import('firebase/firestore').DocumentSnapshot | null }>} `cursor` is
 *   null when the page returned fewer rows than asked for, i.e. the end.
 */
export async function getHospitalDonations(
  hospitalId,
  { since = null, until = null, cursor = null, limit: take = 50 } = {},
) {
  requireDb();
  const id = text(hospitalId);
  if (!id) return { rows: [], cursor: null };

  const constraints = [where("hospitalId", "==", id)];
  const sinceDate = asDate(since);
  if (sinceDate) {
    constraints.push(where("donationDate", ">=", sinceDate));
  }
  const untilDate = asDate(until);
  if (untilDate) constraints.push(where("donationDate", "<", untilDate));
  constraints.push(orderBy("donationDate", "desc"), limit(take));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(
    query(collection(db, "donations"), ...constraints),
  );
  return {
    rows: snap.docs.map(donationRow),
    cursor: snap.docs.length === take ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * A donor's own donation history, newest first (FR-020).
 *
 * @param {string} donorId - the signed-in account's uid
 * @returns {Promise<Array<ReturnType<typeof donationRow>>>}
 */
export async function getDonorDonations(donorId) {
  requireDb();
  const id = text(donorId);
  if (!id) return [];
  const snap = await getDocs(
    query(
      collection(db, "donations"),
      where("donorId", "==", id),
      orderBy("donationDate", "desc"),
    ),
  );
  return snap.docs.map(donationRow);
}

/**
 * Recent inventory change logs for a blood type (schema §2.3.3).
 *
 * @param {string} hospitalId
 * @param {string} bloodType
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{ id: string, changeType: string, unitsChanged: number, reason: string, userId: string, createdAt: Date|null }>>}
 */
export async function getInventoryLogs(
  hospitalId,
  bloodType,
  { limit: take = 20, component = "whole-blood" } = {},
) {
  requireDb();
  const hid = text(hospitalId);
  const bt = text(bloodType);
  if (!hid || !bt) return [];
  const snap = await getDocs(
    query(
      collection(
        db,
        "hospitals",
        hid,
        "inventory",
        component === "unclassified" ? bt : inventoryKey(component, bt),
        "logs",
      ),
      orderBy("createdAt", "desc"),
      limit(take),
    ),
  );
  return snap.docs.map((item) => {
    const data = item.data() ?? {};
    return {
      id: item.id,
      changeType: text(data.changeType),
      unitsChanged: Number(data.unitsChanged) || 0,
      reason: text(data.reason),
      userId: text(data.userId),
      createdAt: asDate(data.createdAt),
    };
  });
}

/**
 * The facilities behind a set of IDs.
 *
 * A missing or unreadable document maps to `null` rather than failing the
 * caller: the history row still shows its date and component.
 *
 * @param {string[]} ids
 * @returns {Promise<Map<string, { id: string, name: string, address: string } | null>>}
 */
export async function readHospitals(ids) {
  requireDb();
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  const rows = await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "hospitals", id));
        if (!snap.exists()) return [id, null];
        const data = snap.data() ?? {};
        return [id, { id, name: text(data.name), address: text(data.address) }];
      } catch {
        return [id, null];
      }
    }),
  );
  return new Map(rows);
}
