/** UI stage gating mirrors the existing sequential workflow; the server remains authoritative. */
export function nextDonationStage(row) {
  if (row?.responseStatus !== 'Accepted' || !row.donor) return null
  return { Responded: 'Screened', Screened: 'Processing', Processing: 'Completed' }[row.donationStage] || null
}
export function validCollectedUnits(value) {
  return String(value).trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 1
}
export function canDeferDonation(row, reason) {
  return Boolean(nextDonationStage(row)) && typeof reason === 'string' && reason.trim().length > 0 && reason.length <= 2000
}
