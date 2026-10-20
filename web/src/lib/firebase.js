import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * The six `VITE_FIREBASE_*` variables, mapped to the `firebaseConfig` field each
 * one feeds. Kept as a table so the missing-key notice can name the variable to
 * edit rather than the field it produces.
 */
const ENV_TO_FIELD = {
  VITE_FIREBASE_API_KEY: 'apiKey',
  VITE_FIREBASE_AUTH_DOMAIN: 'authDomain',
  VITE_FIREBASE_PROJECT_ID: 'projectId',
  VITE_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  VITE_FIREBASE_APP_ID: 'appId',
}

/**
 * Firebase project config, read from Vite's `VITE_FIREBASE_*` variables
 * (`.env.local`, documented in `web/.env.example`).
 *
 * These values are not secrets: a Firebase web API key is a public project
 * identifier and access is enforced by Firebase's own rules. The file holding
 * them is gitignored all the same, so one project is never baked into the repo.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * Whether a Firebase project is configured. The app does not run without one:
 * when false, `firebaseApp`/`auth`/`db` stay null (an empty config makes the
 * SDK throw) and the shell shows `pages/shared/NotConfigured` instead of routes.
 */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim() !== '',
)

/** The `VITE_FIREBASE_*` names that are missing or empty, for the notice screen. */
export const missingFirebaseKeys = Object.entries(ENV_TO_FIELD)
  .filter(([, field]) => {
    const value = firebaseConfig[field]
    return typeof value !== 'string' || value.trim() === ''
  })
  .map(([envName]) => envName)

/**
 * The app, its auth service, and its Firestore database. All three are `null`
 * until `VITE_FIREBASE_*` is set. Always go through `services/*` (and then
 * `hooks/useAuth.jsx`) rather than importing these directly.
 */
export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const googleProvider = firebaseApp ? new GoogleAuthProvider() : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null
