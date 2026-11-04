import { donationStage, responseLabel } from './donationCompletion.js'

export const QUEUE_STAGES = [
  { value: 'Responded', label: 'Not screened' },
  { value: 'Screened', label: 'Screened' },
  { value: 'Processing', label: 'Processing' },
  { value: 'Deferred', label: 'Deferred' },
  { value: 'Rejected', label: 'Rejected' },
]
export const queueFilterFields = { donationStage }

/** Completion records and explicit Completed stages leave the active queue. */
export function pendingDonationRows(matches, history) {
  const completed = new Set(history.map(row => row.id))
  return matches.filter(row => !completed.has(row.id) && donationStage(row) !== 'Completed')
}

/** Stage presentation shares the same normalized value as the filters. */
export function queueStatus(row) {
  if (row.responseStatus !== 'Accepted') return { label: row.responseStatus === 'Pending' ? 'Awaiting donor' : responseLabel(row), tone: row.responseStatus === 'Pending' ? 'pending' : 'rejected' }
  const stage = donationStage(row)
  if (stage === 'Responded') return { label: 'Not screened', tone: 'pending' }
  if (['Deferred', 'Rejected'].includes(stage)) return { label: stage, tone: stage === 'Deferred' ? 'deferred' : 'rejected' }
  if (!row.guidelinesAcknowledged) return { label: 'Guidelines pending', tone: 'pending' }
  return { label: stage, tone: 'ok' }
}
