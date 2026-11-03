import { auth } from '../lib/firebase'

/** One authorized page of request responses; profiles stay behind the consent check. */
export async function listHospitalResponses(requestId, { status = '', after = null, signal } = {}) {
  if (!auth?.currentUser) throw new Error('Sign in again to view donor responses.')
  const endpoint = (import.meta.env.VITE_MATCHING_ENDPOINT || '').trim().replace(/\/$/, '')
  if (!endpoint) throw new Error('Donor responses are unavailable until the hospital service is configured. Contact your administrator.')
  const query = new URLSearchParams({ requestId, status })
  if (after) query.set('after', after)
  let response
  try {
    response = await fetch(`${endpoint}/hospital/request-responses?${query}`, {
      headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }, signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not load responses. Check your connection and try again.')
  }
  const result = await response.json().catch(() => null)
  if (response.status === 404 && (!result?.error || result.error === 'Not found')) throw new Error('The hospital response service needs an update. Contact your administrator.')
  if (response.status === 429) throw new Error('The service has reached its read limit. Please try again later.')
  if (!response.ok || !result?.ok || !Array.isArray(result.rows))
    throw new Error(result?.error || 'Could not load responses. Please try again.')
  return result
}
