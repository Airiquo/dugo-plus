#!/usr/bin/env node
// Publish Firebase Auth custom claims from `users/{uid}` (D15/D26/A1).
//
// Rules read `request.auth.token.role` and `.hospitalId`; the browser cannot
// set claims, so this is an Admin SDK step. Account type `hospital` maps to the
// staff claim `role: 'staff'` because that is what `isStaffOf()` checks
// (schema §6), while `users.role` keeps the shipped `hospital` value.
//
// Usage (key stays outside the repo):
//   GOOGLE_APPLICATION_CREDENTIALS=~/.config/dugo-plus/sa-key.json \
//     npm run set:claims -- [--uid <uid>] [--dry]
//
// After a run, the signed-in client must refresh its token: sign out and in,
// or the one forced `getIdToken(true)` in `hooks/useAuth.jsx` (next page load).

import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const dry = process.argv.includes('--dry')
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const project = process.argv.includes('--project')
  ? process.argv[process.argv.indexOf('--project') + 1]
  : process.env.GCLOUD_PROJECT || 'dugo-plus'
const uidArg = process.argv.includes('--uid')
  ? process.argv[process.argv.indexOf('--uid') + 1]
  : null

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function refuse(message) {
  console.error(`set-claims refused: ${message}`)
  process.exit(1)
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!emulator) {
  if (!keyPath) {
    refuse(
      'GOOGLE_APPLICATION_CREDENTIALS is not set.\n' +
        '  Create a service-account key for dugo-plus in the Firebase console,\n' +
        '  keep it outside the repo (e.g. ~/.config/dugo-plus/sa-key.json),\n' +
        '  then re-run with that variable set.',
    )
  }
  // Case-folded: macOS filesystems are case-insensitive, so a folded path
  // (shell $PWD vs the module's canonical URL) must not slip past.
  const resolvedKey = resolve(keyPath).toLowerCase()
  const repoRootFolded = repoRoot.toLowerCase()
  if (
    resolvedKey === repoRootFolded ||
    resolvedKey.startsWith(repoRootFolded + sep)
  ) {
    refuse(`the service-account key sits inside the repo (${resolvedKey}).`)
  }
}

const app = initializeApp({ credential: applicationDefault(), projectId: project })
const auth = getAuth(app)
const db = getFirestore(app)

/** `users.role` → the claim name the rules check. */
const CLAIM_ROLE = { donor: 'donor', hospital: 'staff', admin: 'admin' }

async function setForUid(uid) {
  const doc = await db.doc(`users/${uid}`).get()
  if (!doc.exists) {
    console.log(`? skip ${uid} (no users/${uid})`)
    return
  }
  const data = doc.data() || {}
  const role = CLAIM_ROLE[data.role]
  if (!role) {
    console.log(`? skip ${uid} (unknown role ${JSON.stringify(data.role)})`)
    return
  }
  const claims = { role }
  if (data.hospitalId) claims.hospitalId = data.hospitalId
  if (dry) {
    console.log(`= dry  ${uid} -> ${JSON.stringify(claims)}`)
    return
  }
  await auth.setCustomUserClaims(uid, claims)
  console.log(`+ set  ${uid} -> ${JSON.stringify(claims)}`)
}

if (uidArg) {
  await setForUid(uidArg)
} else {
  const users = await db.collection('users').get()
  for (const doc of users.docs) await setForUid(doc.id)
}
console.log('\ndone')
process.exit(0)
