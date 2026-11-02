import { callDonorService } from './donorApi'

/** Looks up a city from GPS coordinates through the authenticated Worker. */
export async function cityFromCoordinates({ lat, lng }) {
  const result = await callDonorService(
    'geocode/reverse',
    { latitude: lat, longitude: lng },
    'City lookup is unavailable. Enter your city manually.',
  )
  return result.city
}
