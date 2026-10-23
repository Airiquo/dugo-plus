import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Facility records — `hospitals/{hospitalId}` (schema §2.3). Read-only here:
 * the donation history needs a name for the place a donation happened, and the
 * rules let any signed-in account read a hospital.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Firestore's local copy of `request.auth.uid`; throws when unconfigured. */
function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The facilities behind a set of IDs.
 *
 * A missing or unreadable document maps to `null` rather than failing the
 * caller: the history row still shows its date, component and points.
 *
 * @param {string[]} ids
 * @returns {Promise<Map<string, { id: string, name: string, address: string } | null>>}
 */
export async function readHospitals(ids) {
  requireDb()
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id))]
  const rows = await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'hospitals', id))
        if (!snap.exists()) return [id, null]
        const data = snap.data() ?? {}
        return [
          id,
          { id, name: text(data.name), address: text(data.address) },
        ]
      } catch {
        return [id, null]
      }
    }),
  )
  return new Map(rows)
}
