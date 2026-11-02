import { asPoint, distanceKm } from './geo.js'
import { isCompatibleDonor } from './matching.js'

export const OPEN_REQUESTS = ['urgent', 'collecting', 'matched']
export const COMPONENT_NAMES = {
  'whole-blood': 'Whole blood',
  rbc: 'Red cells',
  platelets: 'Platelets',
  plasma: 'Plasma',
  cryoprecipitate: 'Cryoprecipitate',
  'double-red-cells': 'Double red cells',
}
export const componentName = (value) =>
  COMPONENT_NAMES[value] || value || 'Blood donation'
export const isActiveCommitment = (item) =>
  item.match.responseStatus === 'Accepted' &&
  !item.donated &&
  !['Deferred', 'Rejected'].includes(item.match.screeningStatus) &&
  OPEN_REQUESTS.includes(item.request.status)
export const isAvailableRequest = (item) =>
  item.match.responseStatus === 'Pending' &&
  OPEN_REQUESTS.includes(item.request.status)
export function facilityPoint(item) {
  return (
    asPoint(item.hospital?.latitude, item.hospital?.longitude) ??
    asPoint(item.request.latitude, item.request.longitude)
  )
}
export function enrichRequest(item, position, bloodType) {
  const facility = facilityPoint(item)
  return {
    ...item,
    facility,
    distance:
      position && facility
        ? distanceKm(position.lat, position.lng, facility.lat, facility.lng)
        : null,
    compatible: isCompatibleDonor(
      item.request.bloodType,
      bloodType,
      item.request.component,
    ),
  }
}
export function requestDistance(distance) {
  return Number.isFinite(distance)
    ? `${distance < 1 ? distance.toFixed(1) : Math.round(distance)} km away`
    : 'Distance unavailable'
}
export function directionsUrl(position, facility) {
  if (!facility) return ''
  return position
    ? `https://www.openstreetmap.org/directions?route=${position.lat},${position.lng};${facility.lat},${facility.lng}`
    : `https://www.openstreetmap.org/?mlat=${facility.lat}&mlon=${facility.lng}#map=16/${facility.lat}/${facility.lng}`
}
