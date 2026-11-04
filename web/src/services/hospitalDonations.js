import { auth } from '../lib/firebase'

async function read(path, input, { signal } = {}) {
  const user = auth?.currentUser
  if (!user) throw new Error('Sign in again to view donation records.')
  const endpoint = (import.meta.env.VITE_MATCHING_ENDPOINT || '').trim().replace(/\/$/, '')
  if (!endpoint) throw new Error('The hospital donation service is not configured. Contact your administrator.')
  let response
  try {
    response = await fetch(endpoint + path, { method: 'POST', signal, headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`,
    }, body: JSON.stringify(input) })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not load donation details. Check your connection and try again.')
  }
  const data = await response.json().catch(() => null)
  if (response.status === 429) throw new Error('The service has reached its read limit. Please try again later.')
  if (response.status === 404 && data?.error === 'Not found') throw new Error('The hospital donation service needs an update. Contact your administrator.')
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not load donation records. Please try again.')
  return data
}
/** One bounded, facility-scoped page, optionally filtered by donor or request. */
export const listHospitalDonations = (input, options) => read('/hospital/donations', input, options)
/** On-demand request/donation context with consent-gated donor fields. */
export const readHospitalDonationDetails = (donationId, options) => read('/hospital/donation-details', { donationId }, options)
