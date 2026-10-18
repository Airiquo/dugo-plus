import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

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
 * Whether a Firebase project is configured. While false the app skips auth
 * entirely — the route guard passes through and the admin shell keeps its demo
 * identity — so a fresh clone still renders every screen without credentials.
 */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim() !== '',
)

/**
 * The app and its auth service. Both are `null` until `VITE_FIREBASE_*` is set,
 * because `getAuth()` throws on an empty config. Always go through
 * `services/auth.js` (and then `hooks/useAuth.jsx`) rather than importing these
 * directly.
 */
export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const googleProvider = firebaseApp ? new GoogleAuthProvider() : null
