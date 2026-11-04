import { terminalAttempt } from '../../web/src/utils/donationCompletion.js'
import { eligibilityFor } from '../../web/src/utils/eligibility.js'
import {
  isCompatibleDonor,
  donationTypeForComponent,
} from '../../web/src/utils/matching.js'
import { HttpError } from './http.js'
import { missingDonorProfileFields } from '../../web/src/utils/profileCompletion.js'

const OPEN = new Set(['urgent', 'collecting', 'matched'])

/** Atomic donor responses, including a per-donor lock and legacy commitments. */
export function createDonorResponder(store, clock = () => new Date()) {
  return async function respond(uid, input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Choose a valid response.')
    const {
      matchId,
      responseStatus,
      acknowledged,
      dataSharingConsent,
      screeningConsent,
      location,
    } = input
    if (typeof matchId !== 'string' || !/^[^/\s]{1,256}$/.test(matchId))
      throw new HttpError(400, 'Choose a valid request.')
    if (!['Accepted', 'Declined'].includes(responseStatus))
      throw new HttpError(400, 'Choose accept or decline.')
    const accepting = responseStatus === 'Accepted'
    if (
      accepting &&
      (acknowledged !== true ||
        dataSharingConsent !== true ||
        screeningConsent !== true)
    )
      throw new HttpError(
        400,
        'Review the guidelines and both consent choices before accepting.',
      )
    if (
      location != null &&
      (!Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) ||
        Math.abs(location.latitude) > 90 ||
        Math.abs(location.longitude) > 180)
    )
      throw new HttpError(
        400,
        'Your location is invalid. Refresh and try again.',
      )

    return store.transact(async (tx) => {
      const profile = await tx.get('users', uid)
      if (
        profile?.data?.role !== 'donor' || profile.data.personalDataErased ||
        (profile.data.status || 'Active') !== 'Active'
      )
        throw new HttpError(403, 'An active donor account is required.')
      const match = await tx.get('donorMatches', matchId)
      if (!match || match.data.donorId !== uid)
        throw new HttpError(
          404,
          'This request is not available to your account.',
        )
      const donation = await tx.get('donations', matchId)
      if (donation || terminalAttempt(match.data))
        throw new HttpError(409, 'This donation attempt has ended. Choose another request.')
      if (match.data.responseStatus === responseStatus)
        return { ok: true, responseStatus, matchId }
      const withdrawing =
        match.data.responseStatus === 'Accepted' &&
        responseStatus === 'Declined'
      if (!['Pending', ...(accepting ? ['Declined', 'Expired'] : [])].includes(match.data.responseStatus) && !withdrawing)
        throw new HttpError(409, 'You have already responded to this request.')
      const request = await tx.get('bloodRequests', match.data.requestId)
      if (!request || !OPEN.has(request.data.status))
        throw new HttpError(
          409,
          'This request has closed. Choose another request.',
        )
      if (accepting) {
        const facility = await tx.get('hospitals', request.data.hospitalId)
        if (!facility || (facility.data.status || 'Active') !== 'Active')
          throw new HttpError(409, 'This facility is not available for donations.')
        const missing = missingDonorProfileFields(profile.data)
        if (missing.length)
          throw new HttpError(
            409,
            `Complete your donor profile before accepting: add your ${missing.join(', ')}.`,
          )
        const typeId = donationTypeForComponent(request.data.component)
        const type = typeId ? await tx.get('donationTypes', typeId) : null
        if (!type || !Number.isSafeInteger(type.data.intervalDays) || type.data.intervalDays <= 0)
          throw new HttpError(409, 'The donation interval is unavailable. Try again later.')
        if (
          !isCompatibleDonor(
            request.data.bloodType,
            profile.data.bloodType,
            request.data.component,
          )
        )
          throw new HttpError(
            409,
            'This request is not compatible with your blood type.',
          )
        if (
          !eligibilityFor(
            { ...profile.data, intervalDays: type?.data?.intervalDays || null },
            clock(),
          ).eligible
        )
          throw new HttpError(
            409,
            'You are not eligible for this donation yet. Check your donation history or contact the hospital.',
          )
      }
      const lock = await tx.get('donorCommitments', uid)
      const existingConsents = accepting ? await Promise.all(['data-sharing', 'screening'].map(suffix => tx.get('donorConsents', `${matchId}_${suffix}`))) : []
      let withdrawConsents = []
      if (withdrawing) {
        withdrawConsents = await tx.query({
          from: [{ collectionId: 'donorConsents' }],
          limit: 101,
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'donorId' },
                    op: 'EQUAL',
                    value: { stringValue: uid },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'matchId' },
                    op: 'EQUAL',
                    value: { stringValue: matchId },
                  },
                },
              ],
            },
          },
        })
      }
      if (withdrawConsents.length > 100) throw new HttpError(409, 'Your consent history needs review. Contact support before withdrawing.')
      if (accepting) {
        const accepted = await tx.query({
          from: [{ collectionId: 'donorMatches' }],
          limit: 101,
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'donorId' },
                    op: 'EQUAL',
                    value: { stringValue: uid },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'responseStatus' },
                    op: 'EQUAL',
                    value: { stringValue: 'Accepted' },
                  },
                },
              ],
            },
          },
        })
        if (accepted.length > 100) throw new HttpError(409, 'Your response history needs review. Contact support before accepting.')
        for (const previous of accepted) {
          const previousRequest = await tx.get(
            'bloodRequests',
            previous.data.requestId,
          )
          const donation = await tx.get('donations', previous.id)
          if (
            previous.id !== matchId && !donation &&
            !terminalAttempt(previous.data) &&
            (!previousRequest || OPEN.has(previousRequest.data.status))
          )
            throw new HttpError(
              409,
              'You already have an active donation. Complete it or contact the hospital before accepting another.',
            )
        }
      }
      const now = clock()
      tx.update('donorMatches/' + matchId, {
        responseStatus,
        ...(accepting ? { acceptanceVersion: (match.data.acceptanceVersion || 0) + 1, donationStage: 'Responded', screeningStatus: null, screenedByUserId: null, screenedAt: null, processingAt: null, processingBy: null, deferralReason: null, withdrawnAt: null, donorLatitude: null, donorLongitude: null, locationSharedAt: null } : {}),
        ...(withdrawing
          ? {
              withdrawnAt: now,
              donorLatitude: null,
              donorLongitude: null,
              locationSharedAt: null,
            }
          : {
              guidelinesAcknowledged: accepting,
              acknowledgedAt: accepting ? now : null,
            }),
        ...(accepting && location
          ? {
              donorLatitude: location.latitude,
              donorLongitude: location.longitude,
              locationSharedAt: now,
            }
          : {}),
      })
      for (const consent of withdrawConsents)
        if (!consent.data.revokedAt)
          tx.update('donorConsents/' + consent.id, { revokedAt: now })
      if (withdrawing && lock?.data.matchId === matchId) tx.delete('donorCommitments/' + uid)
      if (accepting) {
        for (const consent of existingConsents.filter(Boolean))
          tx.create(`donorConsents/${consent.id}_v${match.data.acceptanceVersion || 0}`, { ...consent.data, revokedAt: consent.data.revokedAt || now, acceptanceVersion: match.data.acceptanceVersion || 0, acknowledgedAt: match.data.acknowledgedAt || null })
        const commitment = {
          donorId: uid,
          matchId,
          requestId: match.data.requestId,
          acceptedAt: now,
        }
        if (lock) tx.update('donorCommitments/' + uid, commitment)
        else tx.create('donorCommitments/' + uid, commitment)
        for (const [index, [suffix, consentType]] of [
          ['data-sharing', 'Data Sharing'],
          ['screening', 'Screening'],
        ].entries())
          tx[existingConsents[index] ? 'update' : 'create'](`donorConsents/${matchId}_${suffix}`, {
            donorId: uid,
            matchId,
            consentType,
            grantedAt: now,
            revokedAt: null,
          })
      }
      return { ok: true, responseStatus, matchId }
    })
  }
}

/** Marks only the authenticated donor's notifications as read. */
export function createDonorAlertReader(store, clock = () => new Date()) {
  return async (uid, ids) => {
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((id) => typeof id !== 'string' || !/^[^/\s]{1,256}$/.test(id))
    )
      throw new HttpError(400, 'Choose up to 100 valid alerts.')
    return store.transact(async (tx) => {
      const profile = await tx.get('users', uid)
      if (
        profile?.data?.role !== 'donor' ||
        (profile.data.status || 'Active') !== 'Active'
      )
        throw new HttpError(403, 'An active donor account is required.')
      const records = []
      for (const id of [...new Set(ids)]) {
        const record = await tx.get('notifications', id)
        if (!record || record.data.userId !== uid)
          throw new HttpError(403, 'You can only update your own alerts.')
        records.push(record)
      }
      for (const record of records)
        if (!record.data.readAt)
          tx.update('notifications/' + record.id, { readAt: clock() })
      return { ok: true }
    })
  }
}
