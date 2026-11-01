import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function listDonationTypes() {
  requireDb()
  const snap = await getDocs(collection(db, 'donationTypes'))
  return snap.docs.map((entry) => {
    const data = entry.data() ?? {}
    return {
      id: entry.id,
      name: text(data.name) || entry.id,
      intervalDays: Number(data.intervalDays) || 0,
    }
  })
}
