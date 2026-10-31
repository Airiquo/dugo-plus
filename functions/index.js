import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/**
 * Inventory callables — `confirmDonation`, `recordTransfusion`,
 * `adjustInventory` (FR-034, schema §5).
 *
 * Every write of a stock movement, its log, the donation record, the reward
 * and `users.lastDonationAt` happens here, in one transaction with all reads
 * before any write. Staff authority comes from the same custom claims the
 * rules use (D15): `role: 'hospital'` carries the hospitalId, `role: 'admin'`
 * names its target in the payload.
 */

initializeApp()
const db = getFirestore()

// Re-exported for functions/selfcheck.mjs: the emulator harness has no admin
// credentials of its own to open a second handle.
export { db }

const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

/** Movement codes `adjustInventory` may log (schema §2.3.3). */
const ADJUSTMENT_TYPES = ['ADJUSTMENT', 'EXPIRED']

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** A positive whole number, or an `invalid-argument` error naming the field. */
function positiveInt(value, field) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpsError('invalid-argument', `${field} must be a whole number greater than zero.`)
  }
  return n
}

/** The signed unit count of an adjustment: a non-zero whole number. */
function signedInt(value, field) {
  const n = Number(value)
  if (!Number.isInteger(n) || n === 0) {
    throw new HttpsError('invalid-argument', `${field} must be a non-zero whole number.`)
  }
  return n
}

/** The signed-in session, or an `unauthenticated` error. */
function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in again to change inventory.')
  }
}

/**
 * The hospital this call may write to: the caller's claim, checked against a
 * known target. An admin names the hospital in the payload (its claim carries
 * none); a staff claim may only reach its own facility.
 */
function resolveHospital(request, hospitalId) {
  const token = request.auth?.token ?? {}
  if (token.role === 'hospital') {
    const claim = text(token.hospitalId)
    if (!claim) throw new HttpsError('permission-denied', 'This account has no facility linked.')
    if (hospitalId && hospitalId !== claim) {
      throw new HttpsError('permission-denied', 'This account may not change that facility.')
    }
    return claim
  }
  if (token.role === 'admin') {
    const id = text(hospitalId)
    if (!id) throw new HttpsError('invalid-argument', 'A hospitalId is required.')
    return id
  }
  throw new HttpsError('permission-denied', 'This account may not change inventory.')
}

/** The stock of one blood type: zero when the facility has no such document. */
function currentUnits(snap) {
  if (!snap.exists) return 0
  return Math.max(0, Math.trunc(Number(snap.data()?.unitsAvailable) || 0))
}

/** The path of an inventory change log: child of the row it moved (§2.3.3). */
function logRef(hospitalId, bloodType) {
  return db.collection('hospitals').doc(hospitalId).collection('inventory').doc(bloodType).collection('logs').doc()
}

/**
 * Confirm a screened match as a donation: the donation record, the stock
 * increment, its log, the donor's `lastDonationAt` and the reward points.
 *
 * @param {{ matchId: string, units: number, points?: number }} data
 */
export const confirmDonation = onCall(async (request) => {
  requireAuth(request)
  const data = request.data ?? {}
  const matchId = text(data.matchId)
  if (!matchId) throw new HttpsError('invalid-argument', 'A match ID is required.')
  const units = positiveInt(data.units, 'units')
  const points = positiveInt(data.points ?? 10, 'points')

  return db.runTransaction(async (transaction) => {
    const matchSnap = await transaction.get(db.collection('donorMatches').doc(matchId))
    if (!matchSnap.exists) throw new HttpsError('not-found', 'That match does not exist.')
    const match = matchSnap.data()

    // The match may hold the facility and blood type, or inherit them from its
    // request (schema §2.5 stores neither by default).
    let hospitalId = text(match.hospitalId)
    let bloodType = text(match.bloodType)
    const requestId = text(match.requestId)
    if (!hospitalId || !bloodType) {
      if (!requestId) {
        throw new HttpsError('failed-precondition', 'This match is not linked to a request.')
      }
      const requestSnap = await transaction.get(db.collection('bloodRequests').doc(requestId))
      if (!requestSnap.exists) {
        throw new HttpsError('failed-precondition', 'This match points at a missing request.')
      }
      hospitalId = hospitalId || text(requestSnap.data().hospitalId)
      bloodType = bloodType || text(requestSnap.data().bloodType)
    }
    if (!hospitalId) {
      throw new HttpsError('failed-precondition', 'No facility is linked to this match.')
    }
    const staffHospital = resolveHospital(request, hospitalId)

    if (text(match.screeningStatus) !== 'Cleared') {
      throw new HttpsError('failed-precondition', 'This donor has not been cleared to donate.')
    }
    if (match.guidelinesAcknowledged !== true) {
      throw new HttpsError('failed-precondition', 'The donor has not acknowledged the guidelines.')
    }
    if (!BLOOD_TYPES.includes(bloodType)) {
      throw new HttpsError('failed-precondition', 'This match has no usable blood type.')
    }

    const donationRef = db.collection('donations').doc(matchId)
    const donationSnap = await transaction.get(donationRef)
    if (donationSnap.exists) {
      throw new HttpsError('already-exists', 'This match has already been confirmed.')
    }

    const donorId = text(match.donorId)
    if (!donorId) throw new HttpsError('failed-precondition', 'This match has no donor.')
    const donorSnap = await transaction.get(db.collection('users').doc(donorId))
    const donorName = donorSnap.exists ? text(donorSnap.data()?.fullName) : ''

    const inventoryRef = db
      .collection('hospitals')
      .doc(staffHospital)
      .collection('inventory')
      .doc(bloodType)
    // Read so the transaction is reads-before-writes; the increment itself
    // creates the row when the facility has none yet.
    const inventorySnap = await transaction.get(inventoryRef)
    const unitsAvailable = currentUnits(inventorySnap) + units

    const now = FieldValue.serverTimestamp()
    const confirmedBy = text(request.auth.uid)

    transaction.set(donationRef, {
      matchId,
      hospitalId: staffHospital,
      donorId,
      donorName,
      bloodType,
      donationType: text(match.donationTypeId) || text(match.donationType) || null,
      requestId,
      units,
      donationDate: now,
      confirmedBy,
      confirmedAt: now,
    })
    transaction.set(
      inventoryRef,
      { bloodType, unitsAvailable: FieldValue.increment(units), lastUpdated: now },
      { merge: true },
    )
    transaction.set(logRef(staffHospital, bloodType), {
      donationId: matchId,
      userId: confirmedBy,
      changeType: 'DONATION',
      unitsChanged: units,
      createdAt: now,
    })
    // D14: only this transaction writes the deferral clock.
    transaction.set(db.collection('users').doc(donorId), { lastDonationAt: now }, { merge: true })
    transaction.set(db.collection('rewardTransactions').doc(matchId), {
      donorId,
      donationId: matchId,
      points,
      awardedAt: now,
    })

    return { donationId: matchId, hospitalId: staffHospital, bloodType, units, unitsAvailable }
  })
})

/**
 * Issue stock for a transfusion, optionally closing the request it served.
 *
 * @param {{ bloodType: string, units: number, requestId?: string, hospitalId?: string }} data
 */
export const recordTransfusion = onCall(async (request) => {
  requireAuth(request)
  const data = request.data ?? {}
  const bloodType = text(data.bloodType)
  if (!BLOOD_TYPES.includes(bloodType)) {
    throw new HttpsError('invalid-argument', 'Choose a valid blood type.')
  }
  const units = positiveInt(data.units, 'units')
  const requestId = text(data.requestId)

  return db.runTransaction(async (transaction) => {
    let target = text(data.hospitalId)
    if (requestId) {
      const requestSnap = await transaction.get(db.collection('bloodRequests').doc(requestId))
      if (!requestSnap.exists) throw new HttpsError('not-found', 'That request does not exist.')
      const served = requestSnap.data()
      const requestedType = text(served.bloodType)
      if (requestedType && requestedType !== bloodType) {
        throw new HttpsError(
          'invalid-argument',
          `That request is for ${requestedType}, not ${bloodType}.`,
        )
      }
      target = target || text(served.hospitalId)
    }
    const hospitalId = resolveHospital(request, target)

    const inventoryRef = db.collection('hospitals').doc(hospitalId).collection('inventory').doc(bloodType)
    const inventorySnap = await transaction.get(inventoryRef)
    const available = currentUnits(inventorySnap)
    if (available < units) {
      throw new HttpsError(
        'failed-precondition',
        `Only ${available} unit${available === 1 ? '' : 's'} of ${bloodType} are available.`,
      )
    }

    const now = FieldValue.serverTimestamp()
    const userId = text(request.auth.uid)
    const unitsAvailable = available - units

    transaction.set(
      inventoryRef,
      { bloodType, unitsAvailable, lastUpdated: now },
      { merge: true },
    )
    transaction.set(logRef(hospitalId, bloodType), {
      donationId: null,
      userId,
      changeType: 'TRANSFUSION',
      unitsChanged: -units,
      createdAt: now,
    })
    if (requestId) {
      // D24's shipped status set: a served request is `fulfilled`.
      transaction.update(db.collection('bloodRequests').doc(requestId), { status: 'fulfilled' })
    }

    return { hospitalId, bloodType, unitsAvailable }
  })
})

/**
 * A signed stock correction — a manual adjustment or expired units.
 *
 * @param {{ bloodType: string, delta: number, reason: string,
 *           changeType: 'ADJUSTMENT'|'EXPIRED', hospitalId?: string }} data
 */
export const adjustInventory = onCall(async (request) => {
  requireAuth(request)
  const data = request.data ?? {}
  const bloodType = text(data.bloodType)
  if (!BLOOD_TYPES.includes(bloodType)) {
    throw new HttpsError('invalid-argument', 'Choose a valid blood type.')
  }
  const delta = signedInt(data.delta, 'delta')
  const changeType = text(data.changeType)
  if (!ADJUSTMENT_TYPES.includes(changeType)) {
    throw new HttpsError('invalid-argument', 'Choose a valid adjustment type.')
  }
  const reason = text(data.reason)
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required for an adjustment.')

  const hospitalId = resolveHospital(request, data.hospitalId)

  return db.runTransaction(async (transaction) => {
    const inventoryRef = db.collection('hospitals').doc(hospitalId).collection('inventory').doc(bloodType)
    const inventorySnap = await transaction.get(inventoryRef)
    const available = currentUnits(inventorySnap)
    const unitsAvailable = available + delta
    if (unitsAvailable < 0) {
      throw new HttpsError(
        'failed-precondition',
        `Only ${available} unit${available === 1 ? '' : 's'} of ${bloodType} are available.`,
      )
    }

    const now = FieldValue.serverTimestamp()
    transaction.set(
      inventoryRef,
      { bloodType, unitsAvailable, lastUpdated: now },
      { merge: true },
    )
    transaction.set(logRef(hospitalId, bloodType), {
      donationId: null,
      userId: text(request.auth.uid),
      changeType,
      unitsChanged: delta,
      reason,
      createdAt: now,
    })

    return { hospitalId, bloodType, unitsAvailable }
  })
})
