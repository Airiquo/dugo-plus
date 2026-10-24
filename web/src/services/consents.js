import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

export async function createConsent({ donorId, matchId = null, consentType }) {
  requireDb()
  await addDoc(collection(db, 'donorConsents'), {
    donorId,
    matchId: matchId || null,
    consentType,
    grantedAt: serverTimestamp(),
    revokedAt: null,
  })
}

export async function revokeConsent(consentId) {
  requireDb()
  await updateDoc(doc(db, 'donorConsents', consentId), {
    revokedAt: serverTimestamp(),
  })
}
