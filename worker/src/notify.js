/**
 * Notification fan-out for newly created donorMatches.
 *
 * Creates a `notifications/{id}` document per donor (owner-readable) and sends
 * email via Brevo when configured. Failures are logged; deliveryStatus is
 * updated best-effort. Part 2: email path only (SMS deferred until provider keys
 * exist, per D3).
 */

import { getDocument, runQuery, updateDocumentIfUnchanged, writeNewDocuments } from './firestore.js'
import { isEmailEnabled, matchEmailBody, sendEmail } from './email.js'

const RETRY_LIMIT = 3
const RETRY_INTERVAL_MINUTES = 5

function notificationId(requestId, donorId) {
  return `${requestId}_${donorId}`
}

async function loadConfig(env) {
  const config = await getDocument(env, 'systemConfig', 'global')
  const data = config?.data ?? {}
  return {
    notifRetryLimit: Number(data.notifRetryLimit ?? RETRY_LIMIT),
    notifRetryInterval: Number(data.notifRetryInterval ?? RETRY_INTERVAL_MINUTES),
  }
}

/**
 * Create notifications for matches that don't have one yet. Idempotent via
 * deterministic IDs and `currentDocument.exists = false` writes.
 */
export async function notifyNewMatches(env, request, matches) {
  if (!matches || matches.length === 0) return { created: 0, emailed: 0 }

  const writes = []
  for (const match of matches) {
    writes.push({
      path: `notifications/${notificationId(match.requestId, match.donorId)}`,
      data: {
        userId: match.donorId,
        requestId: match.requestId,
        channel: 'Email',
        deliveryStatus: 'Pending',
        retryCount: 0,
        // Explicit null, not omitted: the donor inbox orders by `sentAt`, and
        // Firestore drops documents that lack the orderBy field — a pending
        // notification without it would never appear.
        sentAt: null,
      },
    })
  }

  const written = await writeNewDocuments(env, writes)

  // Emails go out for any notification still Pending (new, or a retry from an
  // earlier run); the status and retry guards below stop a double send.
  let emailed = 0
  if (!isEmailEnabled(env)) return { created: written.created, emailed: 0 }

  const config = await loadConfig(env)
  for (const match of matches) {
    const noteId = notificationId(match.requestId, match.donorId)
    // Re-read to skip if already sent/raced; notification may have been created above
    const note = await getDocument(env, 'notifications', noteId)
    if (!note) continue
    if (note.data?.deliveryStatus === 'Sent') continue
    if ((note.data?.retryCount ?? 0) >= (config.notifRetryLimit ?? RETRY_LIMIT)) continue

    const donor = await getDocument(env, 'users', match.donorId)
    const email = donor?.data?.email
    if (!email) continue

    const body = matchEmailBody({
      requestId: match.requestId,
      component: match.component ?? request.data?.component,
      bloodType: request.data?.bloodType,
      urgencyLevel: request.data?.urgencyLevel,
      hospitalName: request.data?.hospitalName,
    })

    const sent = await sendEmail(env, {
      to: email,
      subject: `Dugo+ — Blood request match (${match.component ?? request.data?.component})`,
      text: body,
    })

    if (sent) {
      const now = new Date()
      await updateDocumentIfUnchanged(
        env,
        `notifications/${noteId}`,
        { deliveryStatus: 'Sent', sentAt: now },
        note.updateTime,
      ).catch(() => {})
      emailed += 1
    } else {
      const retryCount = Number(note.data?.retryCount ?? 0) + 1
      const limit = config.notifRetryLimit ?? RETRY_LIMIT
      await updateDocumentIfUnchanged(
        env,
        `notifications/${noteId}`,
        {
          retryCount,
          // Once the configured retry limit is reached, stop retrying and mark
          // it Failed so the state is visible (schema §2.8, NFR-07).
          ...(retryCount >= limit ? { deliveryStatus: 'Failed' } : {}),
        },
        note.updateTime,
      ).catch(() => {})
    }
  }

  return { created: written.created, emailed }
}

/**
 * Retry failed/pending notifications up to the configured limit.
 */
export async function retryNotifications(env) {
  const config = await loadConfig(env)
  const limit = config.notifRetryLimit ?? RETRY_LIMIT
  if (!isEmailEnabled(env)) return { retried: 0 }

  const rows = await runQuery(env, {
    from: [{ collectionId: 'notifications' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'deliveryStatus' },
              op: 'EQUAL',
              value: { stringValue: 'Pending' },
            },
          },
        ],
      },
    },
    limit: 100,
  })

  let retried = 0
  for (const note of rows) {
    const data = note.data ?? {}
    if ((data.retryCount ?? 0) >= limit) continue
    const donor = await getDocument(env, 'users', data.userId)
    const email = donor?.data?.email
    if (!email) continue

    // Need request details for a better body; best effort
    const req = await getDocument(env, 'bloodRequests', data.requestId)
    const body = matchEmailBody({
      requestId: data.requestId,
      component: req?.data?.component,
      bloodType: req?.data?.bloodType,
      urgencyLevel: req?.data?.urgencyLevel,
      hospitalName: req?.data?.hospitalName,
    })
    const sent = await sendEmail(env, {
      to: email,
      subject: `Dugo+ — Blood request match`,
      text: body,
    })
    if (sent) {
      await updateDocumentIfUnchanged(
        env,
        `notifications/${note.id}`,
        { deliveryStatus: 'Sent', sentAt: new Date() },
        note.updateTime,
      ).catch(() => {})
      retried += 1
    } else {
      const retryCount = Number(data.retryCount ?? 0) + 1
      await updateDocumentIfUnchanged(
        env,
        `notifications/${note.id}`,
        {
          retryCount,
          ...(retryCount >= limit ? { deliveryStatus: 'Failed' } : {}),
        },
        note.updateTime,
      ).catch(() => {})
    }
  }
  return { retried }
}
