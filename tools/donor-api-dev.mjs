/** Loopback donor API using the signed-in Firebase CLI operator's project access. */
import http from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { loadEnv } from '../web/node_modules/vite/dist/node/index.js'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import {
  createDonorResponder,
  createDonorAlertReader,
} from '../worker/src/donorResponses.js'
import { reverseGeocodeCity } from '../worker/src/reverseGeocoding.js'
import { toFirestoreFields, decodeDocument } from '../worker/src/firestore.js'
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const values = loadEnv('development', resolve(repo, 'web'), 'VITE_')
const project = values.VITE_FIREBASE_PROJECT_ID
if (!project)
  throw new Error(
    'Configure web/.env.local before starting the local donor API.',
  )
const require = createRequire(import.meta.url),
  cli = require('firebase-tools/lib/auth.js')
const account = cli.getProjectDefaultAccount(repo)
if (!account)
  throw new Error('Run firebase login before starting the local donor API.')
const credential = {
  getAccessToken: async () => ({
    access_token: (
      await cli.getAccessToken(account.tokens.refresh_token, [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase',
        'https://www.googleapis.com/auth/userinfo.email',
      ])
    ).access_token,
    expires_in: 3600,
  }),
}
const auth = getAuth(initializeApp({ projectId: project, credential }))
const database = `projects/${project}/databases/(default)/documents`
async function rest(suffix, body) {
  const response = await fetch(
    'https://firestore.googleapis.com/v1/' + database + suffix,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${(await credential.getAccessToken()).access_token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  )
  if (response.status === 404) return null
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.error?.message || 'Database unavailable')
    error.status = response.status
    throw error
  }
  return result
}
const store = {
  async transact(work) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { transaction } = await rest(':beginTransaction', {
        options: { readWrite: {} },
      })
      const writes = []
      const tx = {
        async get(collection, id) {
          return decodeDocument(
            await rest(
              '/' +
                collection +
                '/' +
                encodeURIComponent(id) +
                '?transaction=' +
                encodeURIComponent(transaction),
            ),
          )
        },
        async query(structuredQuery) {
          return (await rest(':runQuery', { structuredQuery, transaction }))
            .filter((row) => row.document)
            .map((row) => decodeDocument(row.document))
        },
        create(path, data) {
          writes.push({
            update: {
              name: database + '/' + path,
              fields: toFirestoreFields(data),
            },
            currentDocument: { exists: false },
          })
        },
        update(path, data) {
          writes.push({
            update: {
              name: database + '/' + path,
              fields: toFirestoreFields(data),
            },
            updateMask: { fieldPaths: Object.keys(data) },
            currentDocument: { exists: true },
          })
        },
      }
      try {
        const result = await work(tx)
        await rest(':commit', { transaction, writes })
        return result
      } catch (error) {
        await rest(':rollback', { transaction }).catch(() => {})
        if (error.status === 409 && attempt < 4) continue
        throw error
      }
    }
  },
}
const respond = createDonorResponder(store),
  read = createDonorAlertReader(store)
http
  .createServer(async (request, response) => {
    const origin = request.headers.origin
    const allowed = ['http://127.0.0.1:5173', 'http://localhost:5173']
    if (origin && !allowed.includes(origin)) {
      response.writeHead(403)
      response.end()
      return
    }
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(origin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            Vary: 'Origin',
          }
        : {}),
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers)
      response.end()
      return
    }
    if (
      request.method !== 'POST' ||
      ![
        '/donor/respond',
        '/donor/alerts/read',
        '/donor/geocode/reverse',
      ].includes(request.url)
    ) {
      response.writeHead(404, headers)
      response.end(JSON.stringify({ error: 'Not found' }))
      return
    }
    try {
      const token = request.headers.authorization?.replace(/^Bearer /, '')
      if (!token)
        throw Object.assign(new Error('Sign in again to continue.'), {
          status: 401,
        })
      const user = await auth.verifyIdToken(token, true)
      if (!user.email_verified)
        throw Object.assign(new Error('Verify your email before continuing.'), {
          status: 403,
        })
      let raw = ''
      for await (const chunk of request) {
        raw += chunk
        if (raw.length > 20000)
          throw Object.assign(new Error('Request is too large.'), {
            status: 400,
          })
      }
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        throw Object.assign(new Error('Invalid request.'), { status: 400 })
      }
      const result =
        request.url === '/donor/respond'
          ? await respond(user.uid, body)
          : request.url === '/donor/alerts/read'
            ? await read(user.uid, body.ids)
            : await reverseGeocodeCity(body, {
                endpoint:
                  process.env.DUGO_REVERSE_GEOCODER_URL || undefined,
              })
      response.writeHead(200, headers)
      response.end(JSON.stringify(result))
    } catch (error) {
      const status =
        error.status || (error.code?.startsWith('auth/') ? 401 : 500)
      response.writeHead(status, headers)
      response.end(
        JSON.stringify({
          error:
            status === 500
              ? 'Could not save your changes. Please try again.'
              : error.message,
        }),
      )
    }
  })
  .listen(8788, '127.0.0.1', () =>
    console.log(
      `Local donor API: http://127.0.0.1:8788 (Firebase project ${project})`,
    ),
  )
