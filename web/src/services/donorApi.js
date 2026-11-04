import { auth } from '../lib/firebase'

/** Authenticated donor actions; the endpoint is the Worker's /donor/respond URL. */
export async function callDonorService(action, payload, fallbackMessage, { signal } = {}) {
  const configured = (import.meta.env.VITE_DONOR_RESPONSE_ENDPOINT || '').trim()
  const worker = (import.meta.env.VITE_MATCHING_ENDPOINT || '')
    .trim()
    .replace(/\/$/, '')
  const endpoint = configured
    ? configured.replace(/\/respond\/?$/, '/' + action)
    : worker
      ? `${worker}/donor/${action}`
      : ''
  if (!auth?.currentUser) throw new Error('Sign in again to continue.')
  if (!endpoint)
    throw new Error(
      'This action is temporarily unavailable. Please try again later.',
    )
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Could not connect. Check your connection and try again.')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      result?.error ||
        fallbackMessage ||
        'Could not save your changes. Please try again.',
    )
  return result
}
