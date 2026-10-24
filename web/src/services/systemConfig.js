import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

export async function getSystemConfig() {
  requireDb()
  const snap = await getDoc(doc(db, 'systemConfig', 'global'))
  if (!snap.exists()) return null
  return snap.data() ?? null
}

export const DEFAULT_RADIUS_TIERS = [5, 10, 15, 20, 25]
