import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { BLOOD_TYPES } from './users'

/**
 * Inventory writes — `confirmDonation`, `recordTransfusion`,
 * `adjustInventory` (FR-034). Client transactions, one per movement: the
 * stock row, its append-only log and, for a confirmed match, the donation
 * record are written together with every read before any write. The
 * security rules allow these paths to staff of the facility and admins
 * (D27); `users.lastDonationAt` and `rewardTransactions` stay out of it —
 * they are server-only by D14/D12 and wait for a server path.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Movement codes `adjustInventory` accepts (schema §2.3.3). */
export const ADJUSTMENT_TYPES = ['ADJUSTMENT', 'EXPIRED']

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** A signed-in user ID, or a message asking for a fresh sign-in. */
function requireUser() {
  const uid = auth?.currentUser?.uid ?? ''
  if (!uid) throw new Error('Sign in again to record an inventory change.')
  return uid
}

/** A whole number greater than zero, or a message for the form. */
function positiveInt(value) {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Enter a whole number of units greater than zero.')
  }
  return count
}

/** A blood type the service accepts, or a message for the form. */
function bloodType(value) {
  const type = text(value)
  if (!BLOOD_TYPES.includes(type)) throw new Error('Choose a valid blood type.')
  return type
}

/** A facility ID the write needs up front, or the screen's warning. */
function hospital(value) {
  const id = text(value)
  if (!id) {
    throw new Error('This account is not linked to a facility yet. Ask an administrator to set your hospital.')
  }
  return id
}

/** The stock of one blood type: zero when the facility has no such document. */
function currentUnits(snap) {
  if (!snap.exists) return 0
  return Math.max(0, Math.trunc(Number(snap.data()?.unitsAvailable) || 0))
}

/**
 * Turns a failure into a message the form can show verbatim. Validation
 * inside the transaction throws plain sentences; a rules rejection is the
 * one place the database itself declines the write.
 */
function readable(error) {
  if (error?.code === 'permission-denied') {
    return 'You do not have permission to change this facility. Sign in again, or ask an administrator to check your facility link.'
  }
  return error?.message || 'The stock change could not be saved. Check your connection and try again.'
}

/** Unwraps a `runTransaction` failure into the screen's wording. */
async function submit(work) {
  requireDb()
  try {
    return await runTransaction(db, work)
  } catch (error) {
    const wrapped = new Error(readable(error))
    wrapped.code = typeof error?.code === 'string' ? error.code : ''
    throw wrapped
  }
}

function requireDb() {
  if (!db) throw new Error(NOT_CONFIGURED)
}

/**
 * Confirm a screened match as a donation: the donation record, the stock
 * increment and its log in one transaction. The facility and blood type are
 * the match's own (or its request's); the rules hold the confirming session
 * to a facility it belongs to.
 *
 * @param {{ matchId: string, units: number }} input
 * @returns {Promise<{ donationId: string, hospitalId: string, bloodType: string, units: number, unitsAvailable: number }>}
 */
export async function confirmDonation({ matchId, units } = {}) {
  requireDb()
  const id = text(matchId)
  if (!id) throw new Error('A match ID is required.')
  const unitCount = positiveInt(units)
  const userId = requireUser()

  const work = async (tx) => {
    const matchSnap = await tx.get(doc(db, 'donorMatches', id))
    if (!matchSnap.exists) throw new Error('That match does not exist.')
    const match = matchSnap.data()

    // The match may hold the facility and blood type, or inherit them from
    // its request (schema §2.5 stores neither by default).
    let facility = text(match.hospitalId)
    let type = text(match.bloodType)
    const requestId = text(match.requestId)
    if (!facility || !type) {
      if (!requestId) throw new Error('This match is not linked to a request.')
      const requestSnap = await tx.get(doc(db, 'bloodRequests', requestId))
      if (!requestSnap.exists) throw new Error('This match points at a missing request.')
      facility = facility || text(requestSnap.data().hospitalId)
      type = type || text(requestSnap.data().bloodType)
    }
    if (!facility) throw new Error('No facility is linked to this match.')
    if (text(match.screeningStatus) !== 'Cleared') {
      throw new Error('This donor has not been cleared to donate.')
    }
    if (match.guidelinesAcknowledged !== true) {
      throw new Error('The donor has not acknowledged the guidelines.')
    }
    if (!BLOOD_TYPES.includes(type)) {
      throw new Error('This match has no usable blood type.')
    }

    const donationRef = doc(db, 'donations', id)
    const donationSnap = await tx.get(donationRef)
    if (donationSnap.exists) throw new Error('This match has already been confirmed.')

    const donorId = text(match.donorId)
    if (!donorId) throw new Error('This match has no donor.')

    const inventoryRef = doc(db, 'hospitals', facility, 'inventory', type)
    const unitsAvailable = currentUnits(await tx.get(inventoryRef)) + unitCount

    const now = serverTimestamp()
    tx.set(donationRef, {
      matchId: id,
      hospitalId: facility,
      donorId,
      // Staff cannot read a donor profile (rules §2.1), so the name is left
      // out; the history tables fall back to the donor ID.
      donorName: null,
      bloodType: type,
      donationType: text(match.donationTypeId) || text(match.donationType) || null,
      requestId,
      units: unitCount,
      donationDate: now,
      confirmedBy: userId,
      confirmedAt: now,
    })
    tx.set(
      inventoryRef,
      { bloodType: type, unitsAvailable, lastUpdated: now },
      { merge: true },
    )
    tx.set(doc(collection(db, 'hospitals', facility, 'inventory', type, 'logs')), {
      donationId: id,
      userId,
      changeType: 'DONATION',
      unitsChanged: unitCount,
      createdAt: now,
    })

    return { donationId: id, hospitalId: facility, bloodType: type, units: unitCount, unitsAvailable }
  }
  return submit(work)
}

/**
 * Issue stock for a transfusion, optionally marking the request it served
 * `fulfilled`. The facility count may not go below zero.
 *
 * @param {{ bloodType: string, units: number, requestId?: string,
 *           hospitalId: string }} input
 * @returns {Promise<{ hospitalId: string, bloodType: string, unitsAvailable: number }>}
 */
export async function recordTransfusion({ bloodType, units, requestId, hospitalId } = {}) {
  requireDb()
  const type = bloodType(bloodType)
  const unitCount = positiveInt(units)
  const facility = hospital(hospitalId)
  const userId = requireUser()
  const request = text(requestId)

  const work = async (tx) => {
    if (request) {
      const requestSnap = await tx.get(doc(db, 'bloodRequests', request))
      if (!requestSnap.exists) throw new Error('That request does not exist.')
      const served = requestSnap.data().bloodType
      if (text(served) && text(served) !== type) {
        throw new Error(`That request is for ${served}, not ${type}.`)
      }
    }

    const inventoryRef = doc(db, 'hospitals', facility, 'inventory', type)
    const available = currentUnits(await tx.get(inventoryRef))
    if (available < unitCount) {
      throw new Error(`Only ${available} unit${available === 1 ? '' : 's'} of ${type} are available.`)
    }
    const unitsAvailable = available - unitCount

    const now = serverTimestamp()
    tx.set(
      inventoryRef,
      { bloodType: type, unitsAvailable, lastUpdated: now },
      { merge: true },
    )
    tx.set(doc(collection(db, 'hospitals', facility, 'inventory', type, 'logs')), {
      donationId: null,
      userId,
      changeType: 'TRANSFUSION',
      unitsChanged: -unitCount,
      createdAt: now,
    })
    if (request) tx.update(doc(db, 'bloodRequests', request), { status: 'fulfilled' })

    return { hospitalId: facility, bloodType: type, unitsAvailable }
  }
  return submit(work)
}

/**
 * A signed stock correction with a written reason: `ADJUSTMENT` or
 * `EXPIRED`. The count may not go below zero.
 *
 * @param {{ bloodType: string, delta: number, reason: string,
 *           changeType: 'ADJUSTMENT'|'EXPIRED', hospitalId: string }} input
 * @returns {Promise<{ hospitalId: string, bloodType: string, unitsAvailable: number }>}
 */
export async function adjustInventory({ bloodType, delta, reason, changeType, hospitalId } = {}) {
  requireDb()
  const type = bloodType(bloodType)
  const step = Number(delta)
  if (!Number.isInteger(step) || step === 0) {
    throw new Error('Enter a whole number of units to add or remove.')
  }
  const code = text(changeType)
  if (!ADJUSTMENT_TYPES.includes(code)) throw new Error('Choose a valid adjustment type.')
  if (!text(reason)) throw new Error('A reason is required for an adjustment.')
  const facility = hospital(hospitalId)
  const userId = requireUser()

  const work = async (tx) => {
    const inventoryRef = doc(db, 'hospitals', facility, 'inventory', type)
    const available = currentUnits(await tx.get(inventoryRef))
    const unitsAvailable = available + step
    if (unitsAvailable < 0) {
      throw new Error(`Only ${available} unit${available === 1 ? '' : 's'} of ${type} are available.`)
    }

    const now = serverTimestamp()
    tx.set(
      inventoryRef,
      { bloodType: type, unitsAvailable, lastUpdated: now },
      { merge: true },
    )
    tx.set(doc(collection(db, 'hospitals', facility, 'inventory', type, 'logs')), {
      donationId: null,
      userId,
      changeType: code,
      unitsChanged: step,
      reason: text(reason),
      createdAt: now,
    })

    return { hospitalId: facility, bloodType: type, unitsAvailable }
  }
  return submit(work)
}
