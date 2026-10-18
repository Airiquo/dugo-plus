import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isFirebaseConfigured } from '../lib/firebase'
import {
  observeAuth,
  signIn as signInWithEmail,
  signInWithGoogle as signInWithGooglePopup,
  signOut as signOutOfFirebase,
  signUp as createAccount,
} from '../services/auth'

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
 * Session context — the single source of truth for who is signed in.
 *
 * The provider subscribes to Firebase once (via `services/auth`) and mirrors the
 * session into React state; pages read it with `useAuth()` and call the actions
 * it exposes. When no project is configured, `configured` is false and the app
 * renders with the demo identity instead of forcing a sign-in.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(
    () =>
      observeAuth((next) => {
        setUser(next ? snapshot(next) : null)
        setLoading(false)
      }),
    [],
  )

  const signIn = useCallback(
    (email, password) => signInWithEmail(email, password),
    [],
  )

  const signUp = useCallback(
    // Publish the new snapshot ourselves: `updateProfile()` does not notify
    // `onAuthStateChanged`, so the display name would otherwise lag.
    (name, email, password) =>
      createAccount(name, email, password, (next) => setUser(snapshot(next))),
    [],
  )

  const signInWithGoogle = useCallback(() => signInWithGooglePopup(), [])
  const signOut = useCallback(() => signOutOfFirebase(), [])

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
