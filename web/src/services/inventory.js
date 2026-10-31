import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import { BLOOD_TYPES } from './users'

/**
 * Inventory callables — `confirmDonation`, `recordTransfusion`,
 * `adjustInventory` (FR-034, `functions/index.js`).
 *
 * Every stock movement is written by these three server functions in one
 * transaction with its log, donation record, reward and `lastDonationAt`;
 * the client only reads stock (services/hospitals.js) and calls in here.
 */

const NOT_CONFIGURED = 'Firestore is not available. Copy web/.env.example to web/.env.local.'

/** Movement codes `adjustInventory` accepts (schema §2.3.3). */
export const ADJUSTMENT_TYPES = ['ADJUSTMENT', 'EXPIRED']

/** A trimmed string, or '' for anything that is not a string. */
function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Turns a callable failure into a message the form can show verbatim.
 * Server messages already name the field or the stock that failed, so they
 * pass through; only the transport failures get wording of our own.
 */
function readable(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (code === 'functions/unauthenticated') return 'Sign in again to record an inventory change.'
  if (code === 'functions/not-found' || code === 'functions/internal') {
    return 'The inventory service is not deployed yet. Ask an administrator to deploy the Dugo+ functions, then reload.'
  }
  return error?.message || 'The stock change could not be saved. Check your connection and try again.'
}

/** Runs a callable, or reports the missing Firebase config to the screen. */
async function call(name, data) {
  if (!functions) throw new Error(NOT_CONFIGURED)
  try {
    const result = await httpsCallable(functions, name)(data)
    return result?.data ?? {}
  } catch (error) {
    const wrapped = new Error(readable(error))
    wrapped.code = typeof error?.code === 'string' ? error.code : ''
    throw wrapped
  }
}

/**
 * Confirm a cleared match as a donation: donation record, stock increment,
 * inventory log, the donor's `lastDonationAt` and the reward points.
 *
 * @param {{ matchId: string, units: number, points?: number }} input
 * @returns {Promise<{ donationId: string, hospitalId: string, bloodType: string, units: number }>}
 */
export async function confirmDonation({ matchId, units, points } = {}) {
  const id = text(matchId)
  if (!id) throw new Error('A match ID is required.')
  const unitCount = Number(units)
  if (!Number.isInteger(unitCount) || unitCount < 1) {
    throw new Error('Enter a whole number of units greater than zero.')
  }
  const payload = { matchId: id, units: unitCount }
  if (points != null) payload.points = Number(points)
  return call('confirmDonation', payload)
}

/**
 * Issue stock for a transfusion, optionally closing the request it served.
 *
 * @param {{ bloodType: string, units: number, requestId?: string }} input
 * @returns {Promise<{ hospitalId: string, bloodType: string, unitsAvailable: number }>}
 */
export async function recordTransfusion({ bloodType, units, requestId } = {}) {
  const type = text(bloodType)
  if (!BLOOD_TYPES.includes(type)) throw new Error('Choose a valid blood type.')
  const unitCount = Number(units)
  if (!Number.isInteger(unitCount) || unitCount < 1) {
    throw new Error('Enter a whole number of units greater than zero.')
  }
  const payload = { bloodType: type, units: unitCount }
  const request = text(requestId)
  if (request) payload.requestId = request
  return call('recordTransfusion', payload)
}

/**
 * A signed stock correction with a written reason: `ADJUSTMENT` or `EXPIRED`.
 *
 * @param {{ bloodType: string, delta: number, reason: string,
 *           changeType: 'ADJUSTMENT'|'EXPIRED' }} input
 * @returns {Promise<{ hospitalId: string, bloodType: string, unitsAvailable: number }>}
 */
export async function adjustInventory({ bloodType, delta, reason, changeType } = {}) {
  const type = text(bloodType)
  if (!BLOOD_TYPES.includes(type)) throw new Error('Choose a valid blood type.')
  const step = Number(delta)
  if (!Number.isInteger(step) || step === 0) {
    throw new Error('Enter a whole number of units to add or remove.')
  }
  const code = text(changeType)
  if (!ADJUSTMENT_TYPES.includes(code)) throw new Error('Choose a valid adjustment type.')
  if (!text(reason)) throw new Error('A reason is required for an adjustment.')
  return call('adjustInventory', {
    bloodType: type,
    delta: step,
    reason: text(reason),
    changeType: code,
  })
}
