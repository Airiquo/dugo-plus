import {
  ServiceError,
  bootstrapAdmin,
  createHospitalAccount,
  deleteAuthAccount,
  setClaims,
} from './actions.js'
import { admin } from './firebase.js'

// Host-neutral request handling: routing, CORS, and the admin-token check. The
// per-host adapter (`api/account.js` for Vercel) only moves bytes in and out.

const ADMIN_ACTIONS = new Set(['createHospitalAccount', 'deleteAuthAccount', 'setClaims'])

/** Origins allowed to call the service, from `ALLOWED_ORIGINS` (comma-separated). */
function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function corsHeaders(origin) {
  const allowed = allowedOrigins()
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-bootstrap-token',
    Vary: 'Origin',
  }
  if (allowed.includes('*')) headers['Access-Control-Allow-Origin'] = '*'
  else if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(status, cors, payload) {
  return {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  }
}

/** Verify the caller's Firebase ID token and require the `admin` claim (D15). */
async function requireAdmin(authorization) {
  const { auth } = admin()
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : ''
  if (!token) throw new ServiceError(401, 'Sign in first.')

  let decoded
  try {
    decoded = await auth.verifyIdToken(token)
  } catch {
    throw new ServiceError(401, 'Your session has expired. Sign in again.')
  }
  if (decoded.role !== 'admin') {
    throw new ServiceError(403, 'Only an administrator can manage accounts.')
  }
  return decoded
}

function parseBody(body) {
  if (body && typeof body === 'object') return body
  if (typeof body === 'string' && body.trim()) {
    try {
      return JSON.parse(body)
    } catch {
      throw new ServiceError(400, 'Send a JSON body.')
    }
  }
  return {}
}

/**
 * Answer one request.
 *
 * @param {{ method: string, headers?: Record<string, unknown>, body?: unknown, origin?: string }} request
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: string }>}
 */
export async function handle(request) {
  const method = String(request.method || 'GET').toUpperCase()
  const headers = request.headers ?? {}
  const cors = corsHeaders(request.origin)

  if (method === 'OPTIONS') return { status: 204, headers: cors, body: '' }
  if (method === 'GET') {
    return {
      status: 200,
      headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' },
      body: BOOTSTRAP_PAGE,
    }
  }
  if (method !== 'POST') return json(405, cors, { ok: false, error: 'Use POST.' })

  try {
    const payload = parseBody(request.body)
    const action = typeof payload.action === 'string' ? payload.action : ''

    if (action === 'bootstrap') {
      const token = process.env.BOOTSTRAP_TOKEN
      if (!token) throw new ServiceError(404, 'This action is not enabled.')
      const offered = payload.token || headers['x-bootstrap-token']
      if (offered !== token) throw new ServiceError(403, 'That bootstrap token is not correct.')
      const result = await bootstrapAdmin(payload.email)
      return json(200, cors, { ok: true, ...result })
    }

    if (!ADMIN_ACTIONS.has(action)) {
      throw new ServiceError(400, 'Unknown action.')
    }

    const actor = await requireAdmin(headers.authorization)
    if (action === 'createHospitalAccount') {
      const result = await createHospitalAccount(payload, actor.uid)
      return json(200, cors, { ok: true, ...result })
    }
    if (action === 'deleteAuthAccount') {
      const result = await deleteAuthAccount(payload.uid, actor.uid)
      return json(200, cors, { ok: true, ...result })
    }
    const result = await setClaims(payload.uid)
    return json(200, cors, { ok: true, ...result })
  } catch (error) {
    if (error instanceof ServiceError) {
      return json(error.status, cors, { ok: false, error: error.message })
    }
    // Configuration or SDK failure: name it without leaking the stack.
    return json(500, cors, { ok: false, error: error?.message || 'The account service failed.' })
  }
}

// A one-time page for granting the first admin its claim, so `npm run
// set:claims` is not needed. Shown on GET; the token is checked on POST.
const BOOTSTRAP_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dugo+ account service</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.25rem; }
  label { display: block; margin: 1rem 0 .25rem; font-weight: 600; }
  input { width: 100%; padding: .5rem; border: 1px solid #bbb; border-radius: 6px; }
  button { margin-top: 1rem; padding: .55rem 1rem; border: 0; border-radius: 6px; background: #b00; color: #fff; font-size: 1rem; cursor: pointer; }
  pre { background: #f4f4f4; padding: .75rem; border-radius: 6px; white-space: pre-wrap; }
  .muted { color: #666; font-size: .875rem; }
</style>
</head>
<body>
<h1>Dugo+ account service</h1>
<p class="muted">Grant the first administrator its <code>admin</code> claim. Use this once, then remove <code>BOOTSTRAP_TOKEN</code> from the host's environment.</p>
<form id="form">
  <label for="email">Administrator sign-in email</label>
  <input id="email" type="email" required />
  <label for="token">Bootstrap token</label>
  <input id="token" type="password" required />
  <button type="submit">Grant admin</button>
</form>
<pre id="out" hidden></pre>
<script>
  document.getElementById('form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const out = document.getElementById('out')
    out.hidden = false
    out.textContent = 'Working…'
    try {
      const response = await fetch('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bootstrap',
          email: document.getElementById('email').value,
          token: document.getElementById('token').value,
        }),
      })
      const data = await response.json()
      out.textContent = response.ok
        ? 'Done. ' + data.email + ' is now an administrator. Sign out and back in.'
        : 'Failed: ' + data.error
    } catch (error) {
      out.textContent = 'Failed: ' + error.message
    }
  })
</script>
</body>
</html>
`
