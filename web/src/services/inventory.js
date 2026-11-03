import { auth } from '../lib/firebase'

/** Hospital writes use the authenticated Worker; operation IDs survive uncertain retries. */
export const ADJUSTMENT_TYPES = ['ADJUSTMENT', 'EXPIRED']
const pending = new Map()

async function callInventory(action, payload) {
  const user = auth?.currentUser
  if (!user) throw new Error('Sign in again to continue.')
  const endpoint = (import.meta.env.VITE_MATCHING_ENDPOINT || '').trim().replace(/\/$/, '')
  if (!endpoint) throw new Error('Inventory changes are temporarily unavailable. Contact your administrator.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([user.uid, action, payload])))
  const key = 'dugo:inventory:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  let operationId = pending.get(key)
  try { operationId ||= sessionStorage.getItem(key) } catch { /* Browser storage may be unavailable. */ }
  operationId ||= crypto.randomUUID()
  pending.set(key, operationId)
  try { sessionStorage.setItem(key, operationId) } catch { /* Retain the in-memory operation ID. */ }
  const clear = () => {
    pending.delete(key)
    try { sessionStorage.removeItem(key) } catch { /* No stored operation to remove. */ }
  }
  let response
  try {
    response = await fetch(endpoint + '/inventory', { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}`,
    }, body: JSON.stringify({ action, ...payload, operationId }) })
  } catch { throw new Error('Could not confirm the result. Check your connection, then retry with the same details.') }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    if ([400, 401, 403, 404, 409, 412].includes(response.status)) clear()
    throw new Error(response.status === 404 ? 'The inventory service needs an update. Contact your administrator.'
      : result?.error || 'Could not confirm the result. Retry with the same details.')
  }
  if (!result?.ok || !result?.operationId) throw new Error('Could not confirm the result. Retry with the same details.')
  clear()
  return result
}

export function confirmDonation(input) { return callInventory('confirmDonation', input) }
export function recordTransfusion(input) { return callInventory('recordTransfusion', input) }
export function adjustInventory(input) { return callInventory('adjustInventory', input) }
export function screenDonorMatch(matchId, screeningStatus) {
  return callInventory('screenMatch', { matchId, screeningStatus })
}
