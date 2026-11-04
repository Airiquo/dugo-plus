import { auth } from '../lib/firebase'
import { collectExportPages } from '../utils/tableExport'

/** Facility-scoped directory/history. Only the Worker resolves consent-authorized identities. */
export async function listHospitalDonors(input, { signal } = {}) {
  if (!auth?.currentUser) throw new Error('Sign in again to view facility donors.')
  const endpoint = (import.meta.env.VITE_MATCHING_ENDPOINT || '').trim().replace(/\/$/, '')
  if (!endpoint) throw new Error('The hospital donor service is not configured. Contact your administrator.')
  let response
  try {
    response = await fetch(`${endpoint}/hospital/donors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` },
      body: JSON.stringify(input), signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not connect. Check your connection and try again.')
  }
  const result = await response.json().catch(() => null)
  if (response.status === 404) throw new Error('The hospital donor service needs an update. Contact your administrator.')
  if (!response.ok || !result?.ok || !Array.isArray(result.rows)) throw new Error(result?.error || 'Could not load facility donors. Try again.')
  return result
}

/** Explicit complete export traversal; donor/facility bounds are retained on every page. */
export function exportHospitalDonors(input, onProgress) {
  return collectExportPages(after => listHospitalDonors({ ...input, after }), { cursorKey: 'nextCursor', onProgress })
}
