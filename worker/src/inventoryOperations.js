/** Authorized hospital movements, confirmation and screening with atomic audit delivery. */
import { HttpError } from './http.js'
import { inventoryKey } from '../../web/src/utils/inventory.js'
import { BLOOD_TYPES, COMPONENTS, donationTypeForComponent, isCompatibleDonor } from '../../web/src/utils/matching.js'
import { eligibilityFor } from '../../web/src/utils/eligibility.js'

const OPEN = ['urgent', 'collecting', 'matched']
const ID = /^[^/\s]{1,128}$/
function id(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new HttpError(400, `Choose a valid ${label}.`)
  return value
}
function integer(value, signed = false) {
  if (!Number.isSafeInteger(value) || (signed ? value === 0 : value < 1))
    throw new HttpError(400, 'Enter a whole number of units greater than zero.')
  return value
}
function stockUnits(record) {
  const count = record?.data.unitsAvailable ?? 0
  if (!Number.isSafeInteger(count) || count < 0) throw new HttpError(409, 'This stock record needs an administrator correction.')
  return count
}
function active(record) { return record && (record.data.status || 'Active') === 'Active' }

/** `store` provides Firestore transactions; `hash` binds operation retries to the actor. */
export function createInventoryManager({ store, hash, now = () => new Date() }) {
  return async function execute(actor, input = {}) {
    if (!actor?.uid) throw new HttpError(401, 'Sign in again to continue.')
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Body must be an object.')
    const { action } = input
    if (!['confirmDonation', 'recordTransfusion', 'adjustInventory', 'screenMatch'].includes(action))
      throw new HttpError(400, 'Choose a valid inventory action.')
    const matchAction = ['confirmDonation', 'screenMatch'].includes(action)
    const matchId = matchAction ? id(input.matchId, 'match') : null
    if (!matchAction && !inventoryKey(input.component, input.bloodType))
      throw new HttpError(400, 'Choose a valid blood component and group.')
    const units = action === 'adjustInventory' ? integer(input.delta, true)
      : action === 'screenMatch' ? 0 : integer(input.units)
    const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
    if (reason.length > 2000 || (action === 'adjustInventory' && !reason))
      throw new HttpError(400, 'Provide a reason of 1–2000 characters.')
    if (action === 'adjustInventory' && !['ADJUSTMENT', 'EXPIRED'].includes(input.changeType))
      throw new HttpError(400, 'Choose adjustment or expired stock.')
    if (input.changeType === 'EXPIRED' && units > 0)
      throw new HttpError(400, 'Expired stock must remove units.')
    if (action === 'screenMatch' && !['Cleared', 'Deferred', 'Rejected'].includes(input.screeningStatus))
      throw new HttpError(400, 'Choose Cleared, Deferred or Rejected.')
    if (action !== 'confirmDonation' && (typeof input.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.operationId)))
      throw new HttpError(400, 'A valid operation ID is required.')
    const normalized = matchAction
      ? { action, matchId, ...(action === 'screenMatch' ? { screeningStatus: input.screeningStatus } : { units }) }
      : { action, hospitalId: id(input.hospitalId, 'facility'), bloodType: input.bloodType,
          component: input.component, units, reason, changeType: action === 'adjustInventory' ? input.changeType : 'TRANSFUSION',
          requestId: input.requestId ? id(input.requestId, 'request') : null }
    const operationId = await hash(action === 'confirmDonation'
      ? `inventory-confirm:${matchId}` : `inventory-operation:${actor.uid}:${input.operationId}`)
    const fingerprint = await hash(JSON.stringify(normalized))
    return store.transact(async tx => {
      const profile = await tx.get('users', actor.uid)
      const admin = actor.claims?.role === 'admin' && profile?.data.role === 'admin'
      const staff = ['staff', 'hospital'].includes(actor.claims?.role) && profile?.data.role === 'hospital'
        && profile.data.hospitalId && profile.data.hospitalId === actor.claims.hospitalId
      if (!active(profile) || (!admin && !staff)) throw new HttpError(403, 'An active hospital staff or administrator account is required.')
      const prior = await tx.get('inventoryOperations', operationId)
      let match, request, donor, donation, donationType
      if (matchAction) {
        match = await tx.get('donorMatches', matchId)
        if (!match) throw new HttpError(404, 'This match was not found.')
        request = await tx.get('bloodRequests', id(match.data.requestId, 'request'))
        if (!request) throw new HttpError(404, 'This request was not found.')
      } else if (normalized.requestId) request = await tx.get('bloodRequests', normalized.requestId)
      const hospitalId = matchAction ? id(request.data.hospitalId, 'facility') : normalized.hospitalId
      if (!admin && hospitalId !== actor.claims.hospitalId) throw new HttpError(403, 'This record belongs to another facility.')
      const hospital = await tx.get('hospitals', hospitalId)
      if (!active(hospital)) throw new HttpError(409, 'An active facility is required.')
      if (prior) {
        if (prior.data.fingerprint !== fingerprint) throw new HttpError(409, 'This operation was already used with different details.')
        return { ...prior.data.result, replayed: true }
      }
      let component = normalized.component, bloodType = normalized.bloodType
      if (matchAction) {
        donation = await tx.get('donations', matchId)
        if (donation) throw new HttpError(409, 'This donation has already been confirmed.')
        if (!OPEN.includes(request.data.status)) throw new HttpError(409, 'This request is closed.')
        if (match.data.responseStatus !== 'Accepted' || match.data.guidelinesAcknowledged !== true)
          throw new HttpError(409, 'The donor must accept and acknowledge the guidelines first.')
        for (const [suffix, consentType] of [['data-sharing', 'Data Sharing'], ['screening', 'Screening']]) {
          const consent = await tx.get('donorConsents', `${matchId}_${suffix}`)
          if (!consent || consent.data.donorId !== match.data.donorId || consent.data.matchId !== matchId
              || consent.data.consentType !== consentType || consent.data.revokedAt !== null)
            throw new HttpError(409, 'Current donor consent is missing. Contact Dugo+ support to obtain fresh donor consent before screening.')
        }
        donor = await tx.get('users', id(match.data.donorId, 'donor'))
        if (!active(donor) || donor.data.role !== 'donor') throw new HttpError(409, 'An active donor profile is required.')
        component = request.data.component
        bloodType = donor.data.bloodType
        if (!COMPONENTS.includes(component) || !BLOOD_TYPES.includes(bloodType)
            || !isCompatibleDonor(request.data.bloodType, bloodType, component))
          throw new HttpError(409, 'The donor blood group does not match this request.')
        if (action === 'confirmDonation') {
          if (match.data.screeningStatus !== 'Cleared') throw new HttpError(409, 'Clear this donor before confirming the donation.')
          donationType = await tx.get('donationTypes', donationTypeForComponent(component))
          if (!donationType || !Number.isFinite(donationType.data.intervalDays) || donationType.data.intervalDays <= 0)
            throw new HttpError(409, 'The donation interval is unavailable.')
          if (!eligibilityFor({ ...donor.data, intervalDays: donationType.data.intervalDays }, now()).eligible)
            throw new HttpError(409, 'The donor is currently deferred or ineligible.')
        }
      }
      if (!matchAction && normalized.requestId) {
        if (!request || request.data.hospitalId !== hospitalId || request.data.component !== component
            || !isCompatibleDonor(request.data.bloodType, bloodType, component) || !OPEN.includes(request.data.status))
          throw new HttpError(409, 'Choose an open compatible request at this facility.')
      }
      const stockKey = inventoryKey(component, bloodType)
      const stockPath = `hospitals/${hospitalId}/inventory/${stockKey}`
      const stock = action !== 'screenMatch' ? await tx.get(`hospitals/${hospitalId}/inventory`, stockKey) : null
      if (stock && (stock.data.component !== component || stock.data.bloodType !== bloodType))
        throw new HttpError(409, 'The stock identity needs an administrator correction.')
      const at = now()
      const delta = action === 'recordTransfusion' ? -units : units
      const unitsAvailable = stockUnits(stock) + delta
      if (action !== 'screenMatch' && (!Number.isSafeInteger(unitsAvailable) || unitsAvailable < 0))
        throw new HttpError(409, 'There are not enough units of this component and blood group.')
      let transfusedUnits
      if (action === 'recordTransfusion' && request) {
        const previouslyIssued = request.data.transfusedUnits ?? 0
        if (!Number.isSafeInteger(previouslyIssued) || previouslyIssued < 0) throw new HttpError(409, 'This request’s issued count needs correction.')
        transfusedUnits = previouslyIssued + units
        if (!Number.isSafeInteger(request.data.quantity) || !Number.isSafeInteger(transfusedUnits)
            || transfusedUnits > request.data.quantity) throw new HttpError(409, 'The units exceed this request’s remaining quantity.')
      }
      const result = { ok: true, hospitalId, bloodType, component, operationId,
        ...(action === 'screenMatch' ? { matchId, screeningStatus: input.screeningStatus }
          : { unitsAvailable, units: Math.abs(units), ...(action === 'confirmDonation' ? { donationId: matchId } : {}) }) }
      // Every read above precedes the first write.
      if (action === 'screenMatch') {
        tx.update(`donorMatches/${matchId}`, { screeningStatus: input.screeningStatus, screenedByUserId: actor.uid })
      } else {
        const data = { bloodType, component, unitsAvailable, lastUpdated: at }
        if (stock) tx.update(stockPath, data)
        else tx.create(stockPath, data)
        tx.create(`${stockPath}/logs/${operationId}`, { donationId: action === 'confirmDonation' ? matchId : null,
          userId: actor.uid, component, bloodType, changeType: action === 'confirmDonation' ? 'DONATION' : normalized.changeType,
          unitsChanged: delta, reason, createdAt: at })
        if (action === 'confirmDonation') {
          tx.create(`donations/${matchId}`, { matchId, hospitalId, donorId: match.data.donorId, bloodType,
            component, donationType: donationTypeForComponent(component), requestId: match.data.requestId,
            units, donationDate: at, confirmedAt: at, confirmedBy: actor.uid })
          tx.update(`users/${match.data.donorId}`, { lastDonationAt: at })
        } else if (transfusedUnits != null) tx.update(`bloodRequests/${normalized.requestId}`, {
          transfusedUnits, ...(transfusedUnits === request.data.quantity ? { status: 'fulfilled' } : {}) })
      }
      tx.create(`inventoryOperations/${operationId}`, { fingerprint, result, createdAt: at })
      const eventType = action === 'confirmDonation' ? 'Donation.Confirmed' : action === 'screenMatch' ? 'Donation.Screened'
        : action === 'recordTransfusion' ? 'Inventory.Transfused' : 'Inventory.Adjusted'
      tx.create(`auditOutbox/${operationId}`, { state: 'Pending', nextAttemptAt: at, createdAt: at, eventType,
        entityType: matchAction ? 'user' : 'hospital', entityId: matchAction ? match.data.donorId : hospitalId,
        actorId: actor.uid, actorRole: admin ? 'admin' : 'staff', context: { reason, afterStatus: action === 'screenMatch' ? input.screeningStatus : '' } })
      if (action === 'confirmDonation') tx.create(`auditOutbox/${operationId}-stock`, {
        state: 'Pending', nextAttemptAt: at, createdAt: at, eventType: 'Inventory.DonationReceived',
        entityType: 'hospital', entityId: hospitalId, actorId: actor.uid, actorRole: admin ? 'admin' : 'staff' })
      return result
    })
  }
}
