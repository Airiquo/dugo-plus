import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function listGuidelines(donationTypeId) {
  requireDb()
  if (!donationTypeId) return []
  const snap = await getDocs(collection(db, 'donationTypes', donationTypeId, 'guidelines'))
  return snap.docs.map((entry) => {
    const data = entry.data() ?? {}
    return {
      id: entry.id,
      title: text(data.title),
      description: text(data.description),
    }
  })
}
