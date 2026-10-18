import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  observeAuth,
  signIn as signInWithEmail,
  signInWithGoogle as signInWithGooglePopup,
  signOut as signOutOfFirebase,
  signUp as createAccount,
} from '../services/auth'
import { readProfile, writeProfile } from '../services/users'

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
 * Session context — the single source of truth for who is signed in and what
 * they are allowed to see.
 *
 * The provider subscribes to Firebase once (via `services/auth`) and mirrors the
 * session into React state; pages read it with `useAuth()`. After each session
 * change it also reads the account profile from `services/users`, because
 * Firebase Auth has no role field: `role` is `null` until that document exists,
 * which is what sends first-time Google users to `pages/public/PickRole.jsx`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)

  /**
   * Monotonic id for profile reads. A read captures the id it started under and
   * only the newest one may land, so a slow `getDoc` can never overwrite a role
   * that is already known — which is exactly what happens at sign-up, where the
   * session event fires *before* the profile document is written.
   */
  const profileSeq = useRef(0)

  /** Store a profile and invalidate any read still in flight for this account. */
  const publishProfile = useCallback((next) => {
    profileSeq.current += 1
    setProfile(next)
    setRoleLoading(false)
  }, [])

  useEffect(() => {
    const stop = observeAuth((next) => {
      const snap = next ? snapshot(next) : null
      const seq = (profileSeq.current += 1)
      const current = () => seq === profileSeq.current

      setUser(snap)
      setLoading(false)
      setProfile(null)
      setRoleLoading(Boolean(snap))
      if (!snap) return

      readProfile(snap.uid)
        .then((found) => {
          if (current()) setProfile(found)
        })
        .catch(() => {
          // Unreadable (offline, rules) is not the same as no profile: treat it
          // as missing so the picker retries rather than the app guessing a role.
          if (current()) setProfile(null)
        })
        .finally(() => {
          if (current()) setRoleLoading(false)
        })
    })
    return () => stop?.()
  }, [])

  const signIn = useCallback(
    (email, password) => signInWithEmail(email, password),
    [],
  )

  const signUp = useCallback(
    async (name, email, password, role) => {
      // `createAccount` publishes the snapshot itself, because `updateProfile()`
      // does not notify `onAuthStateChanged`. It writes no Firestore document:
      // the session event it triggers starts a profile read, and publishing the
      // profile from here is what marks that read stale.
      const next = await createAccount(name, email, password, (fresh) =>
        setUser(snapshot(fresh)),
      )
      if (!role) return next
      const data = { role, name: name ?? '', email: next.email ?? '' }
      try {
        await writeProfile(next.uid, data)
        publishProfile(data)
      } catch {
        // Left unwritten, the guard sends them to `pages/public/PickRole.jsx`,
        // which writes it properly rather than the app guessing a role.
      }
      return next
    },
    [publishProfile],
  )

  /**
   * Write the account profile when it is missing (the Google first sign-in) or
   * correcting it, then store it directly so the guards can proceed without
   * waiting for a reload.
   */
  const claimRole = useCallback(
    async (role) => {
      if (!user) throw new Error('No account is signed in.')
      const data = {
        role,
        name: user.displayName ?? '',
        email: user.email ?? '',
      }
      await writeProfile(user.uid, data)
      publishProfile(data)
      return role
    },
    [user, publishProfile],
  )

  const signInWithGoogle = useCallback(() => signInWithGooglePopup(), [])
  const signOut = useCallback(() => signOutOfFirebase(), [])

  const value = useMemo(
    () => ({
      user,
      loading,
      // Null while signed out or while the profile has not been written yet.
      role: profile?.role ?? null,
      profile,
      roleLoading,
      signIn,
      signUp,
      claimRole,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      loading,
      profile,
      roleLoading,
      signIn,
      signUp,
      claimRole,
      signInWithGoogle,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
