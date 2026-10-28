/**
 * Blood type compatibility (donor -> recipient). Based on standard ABO/Rh rules.
 * Donor can donate to recipient if compatible.
 */

const COMPATIBILITY = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
}

export function canDonateTo(donorBloodType, recipientBloodType) {
  if (!donorBloodType || !recipientBloodType) return false
  const allowed = COMPATIBILITY[donorBloodType]
  if (!allowed) return false
  return allowed.includes(recipientBloodType)
}
