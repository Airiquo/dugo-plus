import { callDonorService } from './donorApi'
import { isCompletedDonation } from '../utils/donationCompletion'
import { toDate } from '../utils/eligibility'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { listenDonorMatches } from './matches'
import { getHospital } from './hospitals'

/** Live donor feed, with request closures and confirmed donations included. */
export function listenDonorRequests(uid, callback, onError) {
  let stopped = false,
    failed = false,
    matches = [],
    donations = new Set(),
    donorLastDonationAt = null,
    matchesReady = false,
    donationsReady = false
  const requests = new Map(),
    hospitals = new Map(),
    stops = new Map(),
    pending = new Set()
  const publish = () => {
    if (stopped || failed || !matchesReady || !donationsReady || pending.size)
      return
    callback(
      matches
        .map((match) => ({
          match,
          request: requests.get(match.requestId),
          hospital:
            hospitals.get(requests.get(match.requestId)?.hospitalId) ?? null,
          donated: donations.has(match.id),
          donorLastDonationAt,
        }))
        .filter((item) => item.request),
    )
  }
  const fail = (error) => {
    failed = true
    if (!stopped) onError(error)
  }
  const stopMatches = listenDonorMatches(
    uid,
    (next) => {
      matches = next
      matchesReady = true
      const ids = new Set(next.map((match) => match.requestId).filter(Boolean))
      for (const [id, stop] of stops)
        if (!ids.has(id)) {
          stop()
          stops.delete(id)
          pending.delete(id)
          requests.delete(id)
        }
      for (const id of ids) {
        if (stops.has(id)) continue
        pending.add(id)
        stops.set(
          id,
          onSnapshot(
            doc(db, 'bloodRequests', id),
            async (snap) => {
              if (stopped) return
              const request = snap.exists()
                ? { id: snap.id, ...snap.data() }
                : null
              requests.set(id, request)
              if (request?.hospitalId && !hospitals.has(request.hospitalId)) {
                try {
                  hospitals.set(
                    request.hospitalId,
                    await getHospital(request.hospitalId),
                  )
                } catch {
                  pending.delete(id)
                  fail(
                    new Error(
                      'Hospital details could not be loaded. Please try again.',
                    ),
                  )
                  return
                }
              }
              pending.delete(id)
              publish()
            },
            fail,
          ),
        )
      }
      publish()
    },
    fail,
  )
  const stopDonations = onSnapshot(
    query(collection(db, 'donations'), where('donorId', '==', uid)),
    (snap) => {
      const completed = snap.docs.filter(entry => isCompletedDonation(entry.data()))
      donations = new Set(completed.map(entry => entry.id))
      donorLastDonationAt = completed.reduce((latest, entry) => {
        const at = toDate(entry.data().donationDate)
        return at && Number.isFinite(+at) && (!latest || at > latest) ? at : latest
      }, null)
      donationsReady = true
      publish()
    },
    fail,
  )
  return () => {
    stopped = true
    stopMatches()
    stopDonations()
    for (const stop of stops.values()) stop()
  }
}

/** Discover compatible requests on an explicit wider search; no email alerts are created. */
export function discoverWiderRequests() { return callDonorService('discover', { radiusKm: 50 }) }
