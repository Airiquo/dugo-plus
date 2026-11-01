/**
 * Minimal Firestore REST client for the matching Worker.
 *
 * Authenticates with a service-account JSON secret, caches the OAuth token in
 * the isolate, and converts between Firestore's tagged values and plain JS.
 * Admin credentials bypass rules; the Worker is the only writer of
 * `donorMatches` and `bloodRequests.matching`.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'
const TOKEN_EARLY_MS = 60_000
const GRPC_ALREADY_EXISTS = 6
const GRPC_FAILED_PRECONDITION = 9

let tokenCache = { key: '', token: '', expiresAt: 0 }
let accountCache = { raw: '', account: null }

/** A Firestore or transport failure that the HTTP layer can map to a status. */
export class FirestoreError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'FirestoreError'
    this.status = status
  }
}

function accountFrom(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new FirestoreError(500, 'FIREBASE_SERVICE_ACCOUNT is not configured')
  if (accountCache.raw === raw) return accountCache.account

  let account
  try {
    account = JSON.parse(raw)
  } catch {
    throw new FirestoreError(500, 'FIREBASE_SERVICE_ACCOUNT is not valid JSON')
  }
  if (!account.client_email || !account.private_key || !account.project_id) {
    throw new FirestoreError(500, 'FIREBASE_SERVICE_ACCOUNT is missing required fields')
  }
  accountCache = { raw, account }
  return account
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function pemBytes(pem) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function accessToken(env) {
  const account = accountFrom(env)
  const now = Date.now()
  if (tokenCache.key === account.client_email && tokenCache.expiresAt > now + TOKEN_EARLY_MS) {
    return tokenCache.token
  }

  const issuedAt = Math.floor(now / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned),
  )
  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new FirestoreError(502, `Firestore token exchange failed: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`)
  }

  const token = await response.json()
  if (!token.access_token) throw new FirestoreError(502, 'Firestore token exchange returned no token')
  tokenCache = {
    key: account.client_email,
    token: token.access_token,
    expiresAt: now + (Number(token.expires_in ?? 3600) * 1000),
  }
  return tokenCache.token
}

function documentsUrl(env) {
  const project = accountFrom(env).project_id
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`
}

/** Fully-qualified Firestore document name, e.g. `bloodRequests/abc`. */
export function documentName(env, path) {
  const project = accountFrom(env).project_id
  return `projects/${project}/databases/(default)/documents/${path}`
}

async function firestoreFetch(env, path, init = {}) {
  const token = await accessToken(env)
  const response = await fetch(`${documentsUrl(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new FirestoreError(response.status, `Firestore request failed: ${response.status}${detail ? ` ${detail.slice(0, 300)}` : ''}`)
  }
  return response.json()
}

/** Convert one tagged Firestore value to plain JS. */
export function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('referenceValue' in value) return value.referenceValue
  if ('geoPointValue' in value) {
    return {
      lat: Number(value.geoPointValue.latitude ?? 0),
      lng: Number(value.geoPointValue.longitude ?? 0),
    }
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(fromFirestoreValue)
  }
  if ('mapValue' in value) {
    const result = {}
    for (const [key, child] of Object.entries(value.mapValue.fields ?? {})) {
      result[key] = fromFirestoreValue(child)
    }
    return result
  }
  return null
}

/** Convert one plain JS value to a tagged Firestore value. */
export function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null }
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } }
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value) } }
  }
  return { nullValue: null }
}

/** Convert a plain object to a Firestore `fields` map. */
export function toFirestoreFields(object) {
  const fields = {}
  for (const [key, value] of Object.entries(object ?? {})) {
    if (value !== undefined) fields[key] = toFirestoreValue(value)
  }
  return fields
}

/** Decode a REST document into `{ id, data, updateTime }`. */
export function decodeDocument(document) {
  if (!document) return null
  const data = {}
  for (const [key, value] of Object.entries(document.fields ?? {})) {
    data[key] = fromFirestoreValue(value)
  }
  return {
    id: document.name.split('/').pop(),
    name: document.name,
    data,
    updateTime: document.updateTime,
  }
}

/** Read one document, or null when it does not exist. */
export async function getDocument(env, collection, id) {
  const document = await firestoreFetch(
    env,
    `/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
  )
  return decodeDocument(document)
}

/** Run one structured query and return decoded documents. */
export async function runQuery(env, structuredQuery) {
  const result = await firestoreFetch(env, ':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery }),
  })
  if (!Array.isArray(result)) return []
  return result.filter((row) => row.document).map((row) => decodeDocument(row.document))
}

/**
 * Create documents that must not already exist. Existing documents are counted
 * and left untouched, so a retry never resets a donor's response status.
 */
export async function writeNewDocuments(env, documents) {
  if (documents.length === 0) return { created: 0, existing: 0 }

  const writes = documents.map(({ path, data }) => ({
    update: {
      name: documentName(env, path),
      fields: toFirestoreFields(data),
    },
    currentDocument: { exists: false },
  }))
  const result = await firestoreFetch(env, ':batchWrite', {
    method: 'POST',
    body: JSON.stringify({ writes }),
  })

  const statuses = result?.status ?? []
  let created = 0
  let existing = 0
  for (let index = 0; index < writes.length; index += 1) {
    const status = statuses[index]
    if (!status || !status.code) {
      created += 1
      continue
    }
    if (Number(status.code) === GRPC_ALREADY_EXISTS) {
      existing += 1
      continue
    }
    throw new FirestoreError(status.code ?? 500, status.message || 'Firestore batch write failed')
  }
  return { created, existing }
}

/**
 * Replace masked fields only if the document still has the `updateTime` that
 * was read. Returns false when another writer won the race.
 */
export async function updateDocumentIfUnchanged(env, path, fields, updateTime) {
  if (!updateTime) throw new FirestoreError(500, 'Missing updateTime for conditional write')

  const write = {
    update: {
      name: documentName(env, path),
      fields: toFirestoreFields(fields),
    },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime },
  }
  const result = await firestoreFetch(env, ':batchWrite', {
    method: 'POST',
    body: JSON.stringify({ writes: [write] }),
  })

  const status = result?.status?.[0]
  if (!status || !status.code) return true
  if (Number(status.code) === GRPC_FAILED_PRECONDITION) return false
  throw new FirestoreError(status.code ?? 500, status.message || 'Firestore conditional write failed')
}

/** Begin a read-write transaction; returns its id (opaque, base64). */
export async function beginTransaction(env) {
  const result = await firestoreFetch(env, ':beginTransaction', {
    method: 'POST',
    body: JSON.stringify({ options: { readWrite: {} } }),
  })
  if (!result?.transaction) throw new FirestoreError(500, 'Could not begin a Firestore transaction')
  return result.transaction
}

/**
 * Read one document inside a transaction. A missing document still joins the
 * read set, which is what lets a known-missing doc act as an append lock.
 */
export async function getDocumentInTransaction(env, collection, id, transaction) {
  const document = await firestoreFetch(
    env,
    `/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?transaction=${encodeURIComponent(transaction)}`,
  )
  return decodeDocument(document)
}

/** Run one structured query inside a transaction. */
export async function runQueryInTransaction(env, structuredQuery, transaction) {
  const result = await firestoreFetch(env, ':runQuery', {
    method: 'POST',
    body: JSON.stringify({ structuredQuery, transaction }),
  })
  if (!Array.isArray(result)) return []
  return result.filter((row) => row.document).map((row) => decodeDocument(row.document))
}

/**
 * Commit writes against a transaction id. Throws on any per-write failure; a
 * conflict aborts the transaction (the caller retries).
 */
export async function commitWrites(env, transaction, writes) {
  const result = await firestoreFetch(env, ':commit', {
    method: 'POST',
    body: JSON.stringify({ transaction, writes }),
  })
  const statuses = result?.status ?? []
  for (const status of statuses) {
    if (status?.code) {
      throw new FirestoreError(Number(status.code) || 500, status.message || 'Firestore commit failed')
    }
  }
  return statuses
}
