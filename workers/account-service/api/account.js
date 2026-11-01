import { handle } from '../lib/service.js'

/**
 * Vercel Node function: `POST /api/account`. Moves the request into the
 * host-neutral handler and writes its reply back.
 */
export default async function account(request, response) {
  const result = await handle({
    method: request.method,
    headers: request.headers,
    body: request.body,
    origin: request.headers?.origin,
  })

  response.statusCode = result.status
  for (const [key, value] of Object.entries(result.headers)) {
    response.setHeader(key, value)
  }
  response.end(result.body)
}
