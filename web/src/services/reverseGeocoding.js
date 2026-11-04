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

export async function searchCities(query, options) {
  const result = await callDonorService('geocode/cities', { query }, 'City lookup unavailable. Enter your city manually.', options)
  return result.cities || []
}
