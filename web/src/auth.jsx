import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as signOutOfFirebase,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebase'

const NOT_CONFIGURED =
  'Firebase is not configured. Copy web/.env.example to web/.env.local and add your project values.'

/** Friendly text for the Firebase error codes these screens can produce. */
const ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'That email already has an account — sign in instead.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/popup-blocked': 'Your browser blocked the Google pop-up. Allow pop-ups and try again.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled in the Firebase console.',
  'auth/unauthorized-domain': 'This domain is not authorised in the Firebase console.',
  'auth/network-request-failed': 'Network unreachable — check your connection.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/invalid-api-key': 'Firebase rejected the API key in web/.env.local.',
  // The code the SDK returns verbatim when the key is wrong (dots and all).
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    'Firebase rejected the API key in web/.env.local.',
  'auth/app-not-authorized': 'This domain is not authorised in the Firebase console.',
  'auth/invalid-app-id': 'Firebase rejected the app ID in web/.env.local.',
}

/** Turns a Firebase error into a sentence worth showing a visitor. */
export function authErrorMessage(error) {
  if (!error) return ''
  const mapped = ERROR_MESSAGES[error.code]
  if (mapped) return mapped
  // Unmapped codes would otherwise keep the SDK's "Firebase: Error (auth/…)"
  // wrapper; keep the code (it is the only clue for a misconfiguration) but drop
  // the noise.
  const cleaned = error.message?.replace(/^Firebase:\s*Error\s*\((.+?)\)\.?$/, 'Firebase error: $1')
  return cleaned || 'Something went wrong. Try again.'
}

/** Best available label for a signed-in user, as the shell greets them. */
export function userName(user) {
  if (!user) return ''
  return user.displayName?.trim() || user.email?.split('@')[0] || 'Donor'
}

/**
 * A plain, immutable copy of the SDK user. Firebase mutates its own `User`
 * object in place (e.g. after `updateProfile`), which React would not notice,
 * so the provider stores snapshots instead of the live instance.
 */
function snapshot(user) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    providers: (user.providerData ?? []).map((provider) => provider.providerId),
  }
}

const AuthContext = createContext(null)

/**
 * Drives the app's Firebase session, mirroring `theme.jsx`: one provider at the
 * root (`App.jsx`), one `useAuth()` hook that throws outside it.
 *
 * Exposes `{ user, loading, configured }` plus `signIn`, `signUp`,
 * `signInWithGoogle` and `signOut`. When no project is configured, `configured`
 * is false and every action rejects with a readable message — the app keeps
 * working, just without auth.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Only "loading" while Firebase is configured and its first callback is pending.
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!auth) return undefined
    // Fires on sign-in, sign-out and page load, so a refresh keeps the session.
    return onAuthStateChanged(auth, (next) => {
      setUser(next ? snapshot(next) : null)
      setLoading(false)
    })
  }, [])

  /** Every action shares the same "no project configured" guard. */
  const requireAuth = useCallback(() => {
    if (!auth) throw new Error(NOT_CONFIGURED)
  }, [])

  const signIn = useCallback(
    async (email, password) => {
      requireAuth()
      const credential = await signInWithEmailAndPassword(auth, email, password)
      return credential.user
    },
    [requireAuth],
  )

  const signUp = useCallback(
    async (name, email, password) => {
      requireAuth()
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      if (name) {
        await updateProfile(credential.user, { displayName: name })
      }
      // updateProfile() does not notify listeners, so publish the new snapshot.
      setUser(snapshot(credential.user))
      return credential.user
    },
    [requireAuth],
  )

  const signInWithGoogle = useCallback(async () => {
    requireAuth()
    const credential = await signInWithPopup(auth, googleProvider)
    return credential.user
  }, [requireAuth])

  const signOut = useCallback(async () => {
    if (!auth) return
    await signOutOfFirebase(auth)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [user, loading, signIn, signUp, signInWithGoogle, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
