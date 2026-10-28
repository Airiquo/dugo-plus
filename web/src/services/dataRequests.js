import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/** Create a data subject request (FR-039/NFR-19). */
export async function createDataRequest(uid, requestType) {
  requireDb()
  const data = {
    userId: uid,
    requestType,
    status: 'Pending',
    processedBy: null,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'dataSubjectRequests'), data)
  return ref.id
}

/** List requests for the signed-in user. */
export async function listMyDataRequests(uid) {
  requireDb()
  const q = query(collection(db, 'dataSubjectRequests'), where('userId', '==', uid))
  const snap = await getDocs(q)
  const out = []
  snap.forEach((docSnap) => {
    const d = docSnap.data() ?? {}
    out.push({
      id: docSnap.id,
      userId: d.userId || '',
      requestType: d.requestType || '',
      status: d.status || 'Pending',
      processedBy: d.processedBy || null,
      adminNote: d.adminNote || '',
      resolvedAt: d.resolvedAt || null,
      createdAt: d.createdAt || null,
    })
  })
  return out
}

/** List all requests for admin queue (FR-039). */
export async function listAllDataRequests() {
  requireDb()
  const snap = await getDocs(collection(db, 'dataSubjectRequests'))
  const out = []
  snap.forEach((docSnap) => {
    const d = docSnap.data() ?? {}
    out.push({
      id: docSnap.id,
      userId: d.userId || '',
      requestType: d.requestType || '',
      status: d.status || 'Pending',
      processedBy: d.processedBy || null,
      adminNote: d.adminNote || '',
      resolvedAt: d.resolvedAt || null,
      createdAt: d.createdAt || null,
    })
  })
  return out
}

/** Update a request (admin only). */
export async function updateDataRequest(id, changes) {
  requireDb()
  const data = { ...changes }
  if (changes.status && changes.status !== 'Pending') {
    if (!data.resolvedAt) {
      data.resolvedAt = serverTimestamp()
    }
  }
  await updateDoc(doc(db, 'dataSubjectRequests', id), data)
}
