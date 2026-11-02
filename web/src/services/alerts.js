import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { callDonorService } from './donorApi'

/** Live inbox ordered by delivery time; new matches with null sentAt remain visible. */
export function listenDonorAlerts(uid, callback, onError) {
  return onSnapshot(
    query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      orderBy('sentAt', 'desc'),
    ),
    (snapshot) =>
      callback(
        snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
      ),
    onError,
  )
}
export function markAlertsRead(ids) {
  return callDonorService('alerts/read', { ids })
}
