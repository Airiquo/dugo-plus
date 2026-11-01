/** Keep a non-secret retry ID for each unfinished account operation. */
const memory = new Map()

function error(message, status = 503) {
  return Object.assign(new Error(message), { status })
}

async function digest(value) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/** A storage adapter and fetch implementation may be supplied for isolated tests. */
export async function accountOperationRequest({
  url,
  actorId,
  token,
  action,
  payload,
  fetcher = fetch,
  storage,
}) {
  if (storage === undefined) {
    try {
      storage = globalThis.sessionStorage
    } catch {
      storage = null
    }
  }
  const safePayload = Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => key !== 'password')
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  const key = `dugo-account-operation:${await digest(JSON.stringify({ actorId, action, payload: safePayload }))}`
  let id = memory.get(key)
  try {
    id ||= storage?.getItem(key)
  } catch {
    /* Memory remains available. */
  }
  id ||= crypto.randomUUID()
  memory.set(key, id)
  try {
    storage?.setItem(key, id)
  } catch {
    /* Credentials are never persisted. */
  }
  const send = (body) =>
    fetcher(url, {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  let response
  try {
    const capability = await send({ action: 'capabilities' })
    const version = await capability.json().catch(() => ({}))
    if (!capability.ok || version.accountOperationsVersion !== 2) {
      throw error(
        'Account changes are temporarily unavailable. Please try again later.',
        capability.status === 401 || capability.status === 403
          ? capability.status
          : 503,
      )
    }
    response = await send({ ...payload, action, operationId: id })
  } catch (failure) {
    throw failure.status
      ? failure
      : error(
          'The account service could not be reached. Retry with the same details to check progress.',
        )
  }
  const data = await response.json().catch(() => ({}))
  const forget = () => {
    memory.delete(key)
    try {
      storage?.removeItem(key)
    } catch {
      /* Storage may be unavailable. */
    }
  }
  if (!response.ok) {
    if (
      response.status >= 400 &&
      response.status < 500 &&
      ![408, 409, 429].includes(response.status)
    )
      forget()
    throw error(
      data.error || 'The account change could not be completed.',
      response.status,
    )
  }
  if (data.state !== 'Completed')
    throw error(
      data.message ||
        'This account change is still processing. Retry with the same details to check progress.',
    )
  forget()
  return data
}
