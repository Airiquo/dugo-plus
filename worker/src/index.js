/**
 * Cloudflare Worker entry point for F7.
 *
 * `POST /match` is the immediate trigger used by request creation. The cron
 * handler runs matching fallback and notification retries.
 */

import { verifyIdToken } from './firebase-auth.js'
import { getDocument } from './firestore.js'
import { HttpError, corsHeaders, json } from './http.js'
import { processRequest, runMatchingCycle } from './matcher.js'
import { notifyNewMatches, retryNotifications } from './notify.js'

const REQUEST_ID_PATTERN = /^[^/\s]{1,128}$/

function bearerToken(request) {
  const header = request.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Missing bearer token')
  return header.slice('Bearer '.length).trim()
}

async function route(request, env) {
  const url = new URL(request.url)
  const cors = corsHeaders(request, env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return json({ ok: true, service: 'dugo-matching', part: 1 }, 200, cors)
  }

  if (request.method !== 'POST' || url.pathname !== '/match') {
    return json({ ok: false, error: 'Not found' }, 404, cors)
  }

  let body
  try {
    body = await request.json()
  } catch {
    throw new HttpError(400, 'Body must be JSON')
  }

  const requestId = body?.requestId
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new HttpError(400, 'requestId must be a non-empty document ID')
  }

  const user = await verifyIdToken(env, bearerToken(request))
  const profile = await getDocument(env, 'users', user.uid)
  if (!profile) throw new HttpError(403, 'No DG+ profile for this account')

  const bloodRequest = await getDocument(env, 'bloodRequests', requestId)
  if (!bloodRequest) throw new HttpError(404, 'Request not found')

  const isAdmin = profile.data?.role === 'admin'
  if (!isAdmin && bloodRequest.data?.createdBy !== user.uid) {
    throw new HttpError(403, 'Only the request creator or an admin can start matching')
  }

  const result = await processRequest(env, bloodRequest, { now: new Date(), source: 'api' })
  return json({ ok: true, ...result }, 200, cors)
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    try {
      return await route(request, env)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : Number(error?.status) || 500
      if (status >= 500) console.error('matching request failed', { message: error?.message })
      return json(
        { ok: false, error: status >= 500 ? 'Internal error' : error?.message || 'Request failed' },
        status,
        cors,
      )
    }
  },

  async scheduled(controller, env) {
    try {
      const summary = await runMatchingCycle(env, { now: new Date(controller.scheduledTime) })
      console.log('matching cron complete', {
        considered: summary.considered,
        matched: summary.matched,
        failed: summary.failed,
      })
      // Best-effort retries for pending notifications.
      try {
        const retried = await retryNotifications(env)
        console.log('notification retry complete', retried)
      } catch (error) {
        console.error('notification retry failed', { message: error?.message })
      }
    } catch (error) {
      console.error('matching cron failed', { message: error?.message })
    }
  },
}
