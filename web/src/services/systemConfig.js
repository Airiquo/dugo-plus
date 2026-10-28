/**
 * `systemConfig/global` (schema §2.11) — the tiered-radius ladder and
 * notification-retry settings (FR-041). F4 reads it for the donor map; the F9
 * settings screen reads and writes it.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** Read system config (FR-041). */
export async function readSystemConfig() {
  requireDb()
  const snap = await getDoc(doc(db, 'systemConfig', 'global'))
  if (!snap.exists()) return null
  return snap.data()
}

/** Save system config (admin only, FR-041). */
export async function saveSystemConfig(changes, updatedBy) {
  requireDb()
  const data = {
    ...changes,
    updatedBy: updatedBy || null,
    updatedAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'systemConfig', 'global'), data, { merge: true })
}

/** Read the config, or null. Donor-map alias for `readSystemConfig` (F4). */
export async function getSystemConfig() {
  return readSystemConfig()
}

/** Fallback ladder (km) when the config is unavailable (NFR-05). */
export const DEFAULT_RADIUS_TIERS = [5, 10, 15, 20, 25]
