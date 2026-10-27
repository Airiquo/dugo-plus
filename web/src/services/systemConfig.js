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
