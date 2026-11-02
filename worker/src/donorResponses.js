import { eligibilityFor } from '../../web/src/utils/eligibility.js'
import {
  isCompatibleDonor,
  donationTypeForComponent,
} from '../../web/src/utils/matching.js'
import { HttpError } from './http.js'

const OPEN = new Set(['urgent', 'collecting', 'matched'])
const CLOSED_SCREENING = new Set(['Deferred', 'Rejected'])

/** Atomic donor responses, including a per-donor lock and legacy commitments. */
export function createDonorResponder(store, clock = () => new Date()) {
  return async function respond(uid, input = {}) {
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
        profile?.data?.role !== 'donor' ||
        (profile.data.status || 'Active') !== 'Active'
      )
        throw new HttpError(403, 'An active donor account is required.')
      const match = await tx.get('donorMatches', matchId)
      if (!match || match.data.donorId !== uid)
        throw new HttpError(
          404,
          'This request is not available to your account.',
        )
      if (match.data.responseStatus === responseStatus)
        return { ok: true, responseStatus, matchId }
      const withdrawing =
        match.data.responseStatus === 'Accepted' &&
        responseStatus === 'Declined'
      if (match.data.responseStatus !== 'Pending' && !withdrawing)
        throw new HttpError(409, 'You have already responded to this request.')
      const request = await tx.get('bloodRequests', match.data.requestId)
      if (!request || !OPEN.has(request.data.status))
        throw new HttpError(
          409,
          'This request has closed. Choose another request.',
        )
      if (accepting) {
        const typeId = donationTypeForComponent(request.data.component)
        const type = typeId ? await tx.get('donationTypes', typeId) : null
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
      let withdrawConsents = []
      if (withdrawing) {
        if (await tx.get('donations', matchId))
          throw new HttpError(409, 'This donation has already been confirmed.')
        withdrawConsents = await tx.query({
          from: [{ collectionId: 'donorConsents' }],
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
      if (accepting) {
        const accepted = await tx.query({
          from: [{ collectionId: 'donorMatches' }],
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
        for (const previous of accepted) {
          const previousRequest = await tx.get(
            'bloodRequests',
            previous.data.requestId,
          )
          const donation = await tx.get('donations', previous.id)
          if (
            !donation &&
            !CLOSED_SCREENING.has(previous.data.screeningStatus) &&
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
        ...(withdrawing
          ? {
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
      if (accepting) {
        const commitment = {
          donorId: uid,
          matchId,
          requestId: match.data.requestId,
          acceptedAt: now,
        }
        if (lock) tx.update('donorCommitments/' + uid, commitment)
        else tx.create('donorCommitments/' + uid, commitment)
        for (const [suffix, consentType] of [
          ['data-sharing', 'Data Sharing'],
          ['screening', 'Screening'],
        ])
          tx.create(`donorConsents/${matchId}_${suffix}`, {
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
