/** Editable account snapshots and the server's profile-field allowlist. */
import { HttpError } from './http.js'
import { geohash, isCoordinate } from '../../web/src/utils/geohash.js'

const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
export const PROFILE_FIELD_LABELS = {
  fullName: 'Name', phoneNumber: 'Account phone', city: 'City',
  gender: 'Gender', bloodType: 'Blood type', dateOfBirth: 'Date of birth',
  latitude: 'Latitude', longitude: 'Longitude',
  name: 'Facility name', address: 'Facility address', contactNumber: 'Facility phone',
}

function point(data) {
  return isCoordinate(data.latitude, data.longitude) &&
    (data.geohash || data.latitude !== 0 || data.longitude !== 0)
    ? { latitude: data.latitude, longitude: data.longitude }
    : { latitude: null, longitude: null }
}

function dateValue(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

/** Snapshots expose editable fields in a fixed order for revision hashing. */
export function accountProfileSnapshot(profile, hospital) {
  const data = profile.data
  return {
    uid: profile.id,
    role: data.role,
    email: data.email || '',
    profile: {
      fullName: data.fullName || '', phoneNumber: data.phoneNumber || '',
      ...(data.role === 'donor' ? {
        city: data.city || '', gender: data.gender || '', bloodType: data.bloodType || '',
        dateOfBirth: dateValue(data.dateOfBirth), ...point(data),
      } : {}),
    },
    facility: hospital ? {
      name: hospital.data.name || '', address: hospital.data.address || '',
      contactNumber: hospital.data.contactNumber || '', city: hospital.data.city || data.city || '',
      ...point(hospital.data),
    } : null,
    hospitalId: data.hospitalId || '',
  }
}

function allowed(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, `${label} details are required.`)
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new HttpError(400, `${label} contains a field that cannot be edited here.`)
}

function text(value, label, max, required = false) {
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`)
  const result = value.trim()
  if ((required && !result) || result.length > max)
    throw new HttpError(400, `${label} ${required ? 'is required and ' : ''}must be ${max} characters or fewer.`)
  return result
}

function location(value) {
  const { latitude: lat, longitude: lng } = value
  if (lat == null && lng == null) return { latitude: 0, longitude: 0, geohash: '' }
  if (!isCoordinate(lat, lng))
    throw new HttpError(400, 'Enter both coordinates as numbers within latitude/longitude bounds.')
  return { latitude: lat, longitude: lng, geohash: geohash(lat, lng) }
}

export function normalizeAccountProfile(input, role, now) {
  const base = ['fullName', 'phoneNumber']
  allowed(input.profile, role === 'donor'
    ? [...base, 'city', 'gender', 'bloodType', 'dateOfBirth', 'latitude', 'longitude'] : base, 'Profile')
  const profile = {
    fullName: text(input.profile.fullName, 'Name', 120, true),
    phoneNumber: text(input.profile.phoneNumber, 'Account phone', 40),
  }
  if (role === 'donor') {
    if (input.facility != null) throw new HttpError(400, 'Donors cannot edit facility details.')
    const bloodType = text(input.profile.bloodType, 'Blood type', 3)
    if (bloodType && !BLOOD_TYPES.includes(bloodType)) throw new HttpError(400, 'Choose a valid blood type.')
    const gender = text(input.profile.gender ?? '', 'Gender', 30)
    if (gender && !['Female','Male','Other','Prefer not to say'].includes(gender)) throw new HttpError(400, 'Choose a valid gender.')
    const date = input.profile.dateOfBirth
    let dateOfBirth = null
    if (date !== '') {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new HttpError(400, 'Enter a valid date of birth.')
      dateOfBirth = new Date(`${date}T00:00:00Z`)
      if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth.toISOString().slice(0, 10) !== date || dateOfBirth > now)
        throw new HttpError(400, 'Enter a valid date of birth that is not in the future.')
    }
    return { profile: {
      ...profile, city: text(input.profile.city, 'City', 120),
      bloodType, dateOfBirth, gender, ...location(input.profile),
    }, facility: null }
  }
  allowed(input.facility, ['name', 'address', 'contactNumber', 'city', 'latitude', 'longitude'], 'Facility')
  const facility = {
    name: text(input.facility.name, 'Facility name', 160, true),
    address: text(input.facility.address, 'Facility address', 240, true),
    contactNumber: text(input.facility.contactNumber, 'Facility phone', 40, true),
    city: text(input.facility.city, 'City', 120),
    ...location(input.facility),
  }
  return { profile: { ...profile, city: facility.city, latitude: facility.latitude,
    longitude: facility.longitude, geohash: facility.geohash }, facility }
}
