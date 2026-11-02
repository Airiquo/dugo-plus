/**
 * Cloudflare Worker entry point for F7 and F10.
 *
 * `POST /match` is the immediate trigger used by request creation. The cron
 * handler runs matching fallback and notification retries.
 * F10 adds audit trail endpoints; F9 adds `POST /accounts` for the privileged
 * account operations (FR-040).
 */

import { verifyIdToken } from './firebase-auth.js'
import { createDonorResponder, createDonorAlertReader } from './donorResponses.js'
import { getDocument, transactionStore } from './firestore.js'
import { HttpError, corsHeaders, json } from './http.js'
import { getAccountHistory } from './accountHistory.js'
import { getAuditActivity } from './auditActivity.js'
import { processRequest, runMatchingCycle } from './matcher.js'
import { notifyNewMatches, retryNotifications } from './notify.js'
import { reverseGeocodeCity } from './reverseGeocoding.js'
import {
  getAllAuditBlocks,
  verifyAuditChain,
  appendAuditBlockSimple,
  retryAuditOutbox,
  redactAuditContexts,
} from './audit.js'
import {
  createHospitalAccount,
  deleteAuthAccount,
  setClaims,
  updateAccountStatus,
  getAccountProfile,
  updateAccountProfile,
  eraseAccountData,
  retryAccountOperations,
} from './accounts.js'

const REQUEST_ID_PATTERN = /^[^/\s]{1,128}$/

function bearerToken(request) {
  const header = request.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer '))
    throw new HttpError(401, 'Missing bearer token')
  return header.slice('Bearer '.length).trim()
}

async function route(request, env) {
  const url = new URL(request.url)
  const cors = corsHeaders(request, env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return json({ ok: true, service: 'dugo-matching', part: 1, accountOperationsVersion: 2, accountProfileVersion: 1, auditActivityVersion: 1 }, 200, cors)
  }

  if (request.method === 'POST' && url.pathname === '/donor/respond') {
    const user = await verifyIdToken(env, bearerToken(request))
    let input
    try { input = await request.json() } catch { throw new HttpError(400, 'Body must be JSON') }
    const result = await createDonorResponder(transactionStore(env))(user.uid, input)
    return json(result, 200, cors)
  }

  if (request.method === 'POST' && url.pathname === '/donor/alerts/read') {
    const user = await verifyIdToken(env, bearerToken(request))
    let input
    try { input = await request.json() } catch { throw new HttpError(400, 'Body must be JSON') }
    return json(await createDonorAlertReader(transactionStore(env))(user.uid, input?.ids), 200, cors)
  }

  if (request.method === 'POST' && url.pathname === '/donor/geocode/reverse') {
    await verifyIdToken(env, bearerToken(request))
    let input
    try { input = await request.json() } catch { throw new HttpError(400, 'Body must be JSON') }
    const result = await reverseGeocodeCity(input, {
      endpoint: env.REVERSE_GEOCODER_URL || undefined,
    })
    return json(result, 200, cors)
  }

  // POST /match
  if (request.method === 'POST' && url.pathname === '/match') {
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
    if (!profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'An active DG+ profile is required')

    const bloodRequest = await getDocument(env, 'bloodRequests', requestId)
    if (!bloodRequest) throw new HttpError(404, 'Request not found')

    // Authority from the token's custom claims (D26), not the client-written
    // `users.role`.
    const isAdmin = user.claims?.role === 'admin'
    if (!isAdmin && bloodRequest.data?.createdBy !== user.uid) {
      throw new HttpError(
        403,
        'Only the request creator or an admin can start matching',
      )
    }

    const result = await processRequest(env, bloodRequest, {
      now: new Date(),
      source: 'api',
    })
    return json({ ok: true, ...result }, 200, cors)
  }

  // POST /audit/verify - admin only
  if (request.method === 'POST' && url.pathname === '/audit/verify') {
    const user = await verifyIdToken(env, bearerToken(request))
    const profile = await getDocument(env, 'users', user.uid)
    if (!profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'An active DG+ profile is required')
    if (user.claims?.role !== 'admin') throw new HttpError(403, 'Admin only')

    const result = await verifyAuditChain(env)

    // Optionally anchor to KV if available
    if (env.AUDIT_KV && result.valid && result.count > 0) {
      try {
        const blocks = await getAllAuditBlocks(env)
        const latest = blocks[0]
        await env.AUDIT_KV.put(
          'audit:head',
          JSON.stringify({
            sequence: latest.sequence,
            recordHash: latest.recordHash,
            verifiedAt: new Date().toISOString(),
          }),
        )
      } catch (error) {
        console.error('Failed to anchor audit head', {
          message: error?.message,
        })
      }
    }

    return json({ ok: true, ...result }, 200, cors)
  }

  // GET /accounts/history - active admin only
  if (request.method === 'GET' && url.pathname === '/accounts/history') {
    const user = await verifyIdToken(env, bearerToken(request))
    const profile = await getDocument(env, 'users', user.uid)
    if (user.claims?.role !== 'admin' || !profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'Only an active administrator can view account history.')
    const result = await getAccountHistory(env, url.searchParams.get('accountId'), url.searchParams.get('before'))
    return json({ ok: true, ...result }, 200, cors)
  }

  if (request.method === 'GET' && url.pathname === '/audit/activity') {
    const user = await verifyIdToken(env, bearerToken(request))
    const profile = await getDocument(env, 'users', user.uid)
    if (user.claims?.role !== 'admin' || !profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'Only an active administrator can view audit activity.')
    return json({ ok: true, ...(await getAuditActivity(env, Object.fromEntries(url.searchParams))) }, 200, cors)
  }

  // GET /audit/blocks - admin only
  if (request.method === 'GET' && url.pathname === '/audit/blocks') {
    const user = await verifyIdToken(env, bearerToken(request))
    const profile = await getDocument(env, 'users', user.uid)
    if (!profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'An active DG+ profile is required')
    if (user.claims?.role !== 'admin') throw new HttpError(403, 'Admin only')

    const blocks = await getAllAuditBlocks(env)
    return json({ ok: true, blocks }, 200, cors)
  }

  // POST /audit/append - internal use (for future F10b)
  if (request.method === 'POST' && url.pathname === '/audit/append') {
    const user = await verifyIdToken(env, bearerToken(request))
    const profile = await getDocument(env, 'users', user.uid)
    if (!profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'An active DG+ profile is required')
    if (user.claims?.role !== 'admin') throw new HttpError(403, 'Admin only')

    let body
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Body must be JSON')
    }

    if (
      typeof body?.eventType !== 'string' ||
      body.eventType.startsWith('Account.') ||
      body.eventType === 'DataAccess.Erasure'
    )
      throw new HttpError(
        400,
        'Account events must be generated by the account operation.',
      )

    const result = await appendAuditBlockSimple(env, {
      eventType: body.eventType,
      entityType: body.entityType,
      entityId: body.entityId,
      actorId: user.uid,
      actorRole: user.claims?.role || profile.data?.role,
      correctsBlockId: body.correctsBlockId,
    })

    return json({ ok: true, ...result }, 200, cors)
  }

  if (request.method === 'GET' && url.pathname === '/accounts/profile') {
    const user = await verifyIdToken(env, bearerToken(request))
    if (user.claims?.role !== 'admin') throw new HttpError(403, 'Admin only')
    return json({ ok: true, ...(await getAccountProfile(env, url.searchParams.get('uid'), user.uid)) }, 200, cors)
  }

  // POST /accounts - privileged account operations (FR-040), admin only
  if (request.method === 'POST' && url.pathname === '/accounts') {
    const user = await verifyIdToken(env, bearerToken(request))
    const profile = await getDocument(env, 'users', user.uid)
    if (!profile || (profile.data.status || 'Active') !== 'Active')
      throw new HttpError(403, 'An active DG+ profile is required')
    if (user.claims?.role !== 'admin') {
      throw new HttpError(403, 'Only an administrator can manage accounts')
    }

    let body
    try {
      body = await request.json()
    } catch {
      throw new HttpError(400, 'Body must be JSON')
    }

    const action = typeof body?.action === 'string' ? body.action : ''
    if (action === 'capabilities')
      return json({ ok: true, accountOperationsVersion: 2 }, 200, cors)
    if (action === 'createHospitalAccount') {
      const result = await createHospitalAccount(env, body, user.uid)
      return json({ ok: true, ...result }, 200, cors)
    }
    if (action === 'deleteAuthAccount') {
      const result = await deleteAuthAccount(
        env,
        body.uid,
        user.uid,
        body.reason,
        body.operationId,
      )
      return json({ ok: true, ...result }, 200, cors)
    }
    if (action === 'updateAccountStatus')
      return json(
        { ok: true, ...(await updateAccountStatus(env, body, user.uid)) },
        200,
        cors,
      )
    if (action === 'updateAccountProfile')
      return json({ ok: true, ...(await updateAccountProfile(env, body, user.uid)) }, 200, cors)
    if (action === 'eraseAccountData')
      return json(
        { ok: true, ...(await eraseAccountData(env, body, user.uid)) },
        200,
        cors,
      )
    if (action === 'setClaims') {
      const result = await setClaims(env, body.uid)
      return json({ ok: true, ...result }, 200, cors)
    }
    throw new HttpError(400, 'Unknown action')
  }

  return json({ ok: false, error: 'Not found' }, 404, cors)
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    try {
      return await route(request, env)
    } catch (error) {
      const status =
        error instanceof HttpError ? error.status : Number(error?.status) || 500
      if (status >= 500)
        console.error('matching request failed', { message: error?.message })
      return json(
        {
          ok: false,
          error:
            status >= 500
              ? 'Internal error'
              : error?.message || 'Request failed',
        },
        status,
        cors,
      )
    }
  },

  async scheduled(controller, env) {
    const maintenance = [
      ['account recovery', () => retryAccountOperations(env)],
      ['audit delivery', () => retryAuditOutbox(env)],
      ['audit redaction', () => redactAuditContexts(env)],
    ].map(async ([name, task]) => {
      try {
        await task()
      } catch {
        console.error(`${name} failed`)
      }
    })
    const matching = (async () => {
      try {
        const summary = await runMatchingCycle(env, {
          now: new Date(controller.scheduledTime),
        })
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
          console.error('notification retry failed', {
            message: error?.message,
          })
        }
      } catch (error) {
        console.error('matching cron failed', { message: error?.message })
      }
    })()
    await Promise.allSettled([...maintenance, matching])
  },
}
