import {
  addDoc,
  collection,
  doc,
  getDocs,
  documentId,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { recordAuditEvent } from './audit'
import { REJECTION_REASONS } from '../utils/dataRequestReview'

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/**
 * Data-subject request vocabulary (schema §2.12). The stored values keep the
 * schema's names; the screen shows the prompt's wording (Correction, Deletion)
 * through `REQUEST_TYPE_LABELS`.
 */
export const REQUEST_TYPES = ['Access', 'Rectification', 'Erasure', 'Export', 'Other']

/** Every request status the queue can move through. */
export const REQUEST_STATUSES = ['Pending', 'InProgress', 'Completed', 'Rejected']

/** The action an administrator recorded when closing a request. */
export const RESOLUTION_ACTIONS = ['', 'Export', 'Correction', 'Deletion', 'Response']

/** Human labels for the stored request types. */
const REQUEST_TYPE_LABELS = {
  Access: 'Access to my data',
  Rectification: 'Correction of my data',
  Erasure: 'Deletion of my data',
  Export: 'Export of my data',
  Other: 'Other data request',
}

const REQUEST_STATUS_LABELS = {
  Pending: 'Pending',
  InProgress: 'In progress',
  Completed: 'Completed',
  Rejected: 'Rejected',
}

/** Longest free-text either side may store. Mirrors the rules. */
export const DETAILS_LIMIT = 2000

/** @param {string} type */
export function requestTypeLabel(type) {
  return REQUEST_TYPE_LABELS[type] ?? type ?? ''
}

/** @param {string} status */
export function requestStatusLabel(status) {
  return REQUEST_STATUS_LABELS[status] ?? status ?? ''
}

/**
 * The action a correction request needs the admin to perform, derived from the
 * subject's own words only where the type makes it unambiguous.
 *
 * @param {string} requestType
 * @returns {'Export'|'Correction'|'Deletion'|''}
 */
export function defaultResolutionAction(requestType) {
  if (requestType === 'Export' || requestType === 'Access') return 'Export'
  if (requestType === 'Rectification') return 'Correction'
  if (requestType === 'Erasure') return 'Deletion'
  return ''
}

function normalise(snap) {
  const d = snap.data() ?? {}
  return {
    id: snap.id,
    userId: d.userId || '',
    requestType: REQUEST_TYPES.includes(d.requestType) ? d.requestType : (d.requestType || ''),
    status: REQUEST_STATUSES.includes(d.status) ? d.status : 'Pending',
    details: typeof d.details === 'string' ? d.details : '',
    adminNote: typeof d.adminNote === 'string' ? d.adminNote : '',
    rejectionReason: typeof d.rejectionReason === 'string' ? d.rejectionReason : '',
    resolutionAction: RESOLUTION_ACTIONS.includes(d.resolutionAction) ? d.resolutionAction : '',
    processedBy: d.processedBy || null,
    resolvedAt: d.resolvedAt || null,
    createdAt: d.createdAt || null,
  }
}

/**
 * Open a data-subject request (FR-039/NFR-19).
 *
 * `details` is what the subject wants: which fields to correct, what to erase,
 * or the address the export should reach. The rules validate the same shape,
 * so this check is the readable half of the boundary.
 *
 * @param {string} uid
 * @param {string} requestType one of `REQUEST_TYPES`
 * @param {string} details
 * @returns {Promise<string>} the new request id
 */
export async function createDataRequest(uid, requestType, details) {
  requireDb()
  if (!uid) throw new Error('Sign in again to submit a request.')
  if (!REQUEST_TYPES.includes(requestType)) throw new Error('Choose what you are asking for.')
  const note = typeof details === 'string' ? details.trim() : ''
  if (!note) throw new Error('Describe what you need so the team can act on it.')
  if (note.length > DETAILS_LIMIT) {
    throw new Error(`Keep the description under ${DETAILS_LIMIT} characters.`)
  }

  const ref = await addDoc(collection(db, 'dataSubjectRequests'), {
    userId: uid,
    requestType,
    status: 'Pending',
    details: note,
    adminNote: '',
    rejectionReason: '',
    resolutionAction: '',
    processedBy: null,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Requests belonging to one account, newest first. */
export async function listMyDataRequests(uid) {
  requireDb()
  if (!uid) throw new Error('Sign in again to view your requests.')
  return readRequests([where('userId', '==', uid)])
}

/** Every request, for the admin queue (FR-039). Requires an admin claim. */
export async function listAllDataRequests() {
  requireDb()
  return readRequests([])
}

/** Complete explicit history loads use bounded batches, including legacy rows. */
async function readRequests(scope) {
  const rows = []
  let cursor
  do {
    const snap = await getDocs(query(collection(db, 'dataSubjectRequests'), ...scope,
      orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(100)))
    rows.push(...snap.docs.map(normalise))
    cursor = snap.size === 100 ? snap.docs.at(-1) : null
  } while (cursor)
  return rows.sort((a, b) => time(b.createdAt) - time(a.createdAt))
}

function time(value) {
  if (!value) return 0
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  return 0
}

/**
 * Move a request through the queue and record the action taken.
 *
 * A closed request always takes `resolvedAt` from the server clock, and the
 * rules require `processedBy` to be the signed-in administrator.
 *
 * @param {string} id
 * @param {{
 *   status: 'Pending'|'InProgress'|'Completed'|'Rejected',
 *   processedBy: string,
 *   adminNote?: string,
 *   rejectionReason?: string,
 *   resolutionAction?: ''|'Export'|'Correction'|'Deletion'|'Response',
 * }} changes
 */
export async function updateDataRequest(id, changes) {
  requireDb()
  if (!REQUEST_STATUSES.includes(changes.status)) throw new Error('Unknown request status.')
  const note = typeof changes.adminNote === 'string' ? changes.adminNote.trim() : ''
  if (note.length > DETAILS_LIMIT) {
    throw new Error(`Keep the note under ${DETAILS_LIMIT} characters.`)
  }
  const closed = changes.status === 'Completed' || changes.status === 'Rejected'
  if (closed && !note) throw new Error('Add a written response before closing this request.')
  if (changes.status !== 'Pending' && !changes.processedBy) throw new Error('Sign in again to review this request.')
  if (changes.status === 'Rejected' && !REJECTION_REASONS.some(option => option.value === changes.rejectionReason)) {
    throw new Error('Choose a rejection reason and explain it in the response.')
  }
  const action = RESOLUTION_ACTIONS.includes(changes.resolutionAction)
    ? changes.resolutionAction
    : ''
  if (changes.status === 'Completed' && !action) throw new Error('Record the action taken before completing this request.')

  const data = {
    status: changes.status,
    processedBy: changes.status === 'Pending' ? null : changes.processedBy || null,
    adminNote: note,
    rejectionReason: changes.status === 'Rejected' ? changes.rejectionReason : '',
    resolutionAction: action,
  }
  if (changes.status === 'Completed' || changes.status === 'Rejected') {
    data.resolvedAt = serverTimestamp()
  } else {
    data.resolvedAt = null
  }
  await updateDoc(doc(db, 'dataSubjectRequests', id), data)

  // F10b: closing a request records what was done (FR-042).
  if (changes.status === 'Completed' || changes.status === 'Rejected') {
    await recordAuditEvent({
      eventType: changes.status === 'Rejected' ? 'DataAccess.Rejected' : `DataAccess.${action || 'Processed'}`,
      entityType: 'dataSubjectRequest',
      entityId: id,
    })
  }
}
