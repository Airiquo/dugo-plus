import { filterRecords } from './recordFilters.js'
import { sortDate, sortRows } from './sortRows.js'

export const donorDirectoryColumns = [
  { label: 'Donor reference', value: row => row.id },
  { label: 'Name (when shared)', value: row => row.donor?.fullName || '' },
  { label: 'Blood group (when shared)', value: row => row.donor?.bloodType || '' },
  { label: 'Email (when shared)', value: row => row.donor?.email || '' },
  { label: 'Phone (when shared)', value: row => row.donor?.phoneNumber || '' },
  { label: 'City (when shared)', value: row => row.donor?.city || '' },
  { label: 'Profile access', value: row => row.donor ? 'Shared' : 'Private' },
]
export const donorHistoryColumns = [
  { label: 'Donation reference', value: row => row.id },
  { label: 'Donor reference', value: row => row.donorId },
  { label: 'Request reference', value: row => row.requestId },
  { label: 'Donation date', value: row => row.donationDate },
  { label: 'Blood group', value: row => row.bloodType },
  { label: 'Component', value: row => row.component },
  { label: 'Actual units', value: row => row.units },
  { label: 'Completed at', value: row => row.completedAt },
]

/** Identical filter/order logic for page views and complete, explicitly requested exports. */
export function filterHospitalDonors(rows, filters, sort, history = false) {
  const filtered = filterRecords(rows, filters, history ? {
    date: row => row.donationDate,
    search: row => `${row.id} ${row.requestId}`,
  } : {
    search: row => `${row.id} ${row.donor?.fullName || ''} ${row.donor?.city || ''}`,
    fields: { bloodType: row => row.donor?.bloodType || 'private' },
  })
  const accessors = history ? {
    date: row => sortDate(row.donationDate), bloodType: row => row.bloodType,
    component: row => row.component, units: row => row.units,
  } : { donor: row => row.donor?.fullName || row.id, bloodType: row => row.donor?.bloodType || '' }
  return sort.key ? sortRows(filtered, accessors[sort.key], sort.direction) : filtered
}
