import { toDate } from './eligibility.js'

const BLOOD_TYPES = new Set(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'])

/** Fields a donor must save before accepting a matched blood request. */
export function missingDonorProfileFields(profile = {}) {
  const missing = []
  if (typeof profile.fullName !== 'string' || !profile.fullName.trim())
    missing.push('name')
  if (!BLOOD_TYPES.has(profile.bloodType)) missing.push('blood type')
  if (!toDate(profile.dateOfBirth)) missing.push('date of birth')
  if (typeof profile.city !== 'string' || !profile.city.trim())
    missing.push('city')
  return missing
}

export function isDonorProfileComplete(profile) {
  return missingDonorProfileFields(profile).length === 0
}
