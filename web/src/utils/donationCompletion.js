/** Completed records include historical confirmations without changing their stock. */
export const isCompletedDonation = data => !!data && (data.status === 'Completed' || !!data.confirmedAt)
export function donationStage(match = {}) {
  if (['Deferred', 'Rejected'].includes(match.screeningStatus)) return match.screeningStatus
  return match.donationStage || (match.screeningStatus === 'Cleared' ? 'Screened' : 'Responded')
}
export const terminalAttempt = match => ['Completed', 'Deferred', 'Rejected'].includes(donationStage(match))
export const responseLabel = match => match.responseStatus === 'Accepted' ? 'Responded'
  : match.responseStatus === 'Declined' && match.withdrawnAt ? 'Withdrew' : match.responseStatus
