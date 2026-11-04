/** Queue groups retain each request's actual outcome. */
export function matchesRequestStatus(status, filter) {
  if (filter === 'all') return true
  if (filter === 'open') return status === 'Pending' || status === 'InProgress'
  if (filter === 'closed') return status === 'Completed' || status === 'Rejected'
  return status === filter
}
export const REJECTION_REASONS = [
  { value: 'InsufficientDetails', label: 'More information needed' },
  { value: 'Duplicate', label: 'Duplicate request' },
  { value: 'OutsideScope', label: 'Outside Dugo+ data scope' },
  { value: 'Other', label: 'Other' },
]

export function rejectionReasonLabel(reason) {
  return REJECTION_REASONS.find(option => option.value === reason)?.label || 'No reason category recorded'
}

