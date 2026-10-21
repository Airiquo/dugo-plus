import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  observeAuth,
  reloadCurrentUser,
  sendVerificationEmail,
  signIn as signInWithEmail,
  signInWithGoogle as signInWithGooglePopup,
  signOut as signOutOfFirebase,
  signUp as createAccount,
} from '../services/auth'
import { readProfile, writeProfile } from '../services/users'

// No picker screen: self-registration is donor-only (D20), so a session with
// no profile document is provisioned as a donor. Hospital and admin accounts
// are created by the Dugo+ team, and their `users/{uid}` documents already
// exist — the rules freeze `role`, so this write cannot demote one.
const DEFAULT_ROLE = 'donor'

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
    emailVerified: Boolean(user.emailVerified),
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
 * Firebase Auth has no role field: a session whose profile document is missing
 * is provisioned as a donor (D20), so `role` is only ever `null` while that
 * read or write is still settling.
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
        .then(async (found) => {
          // Auto-provision (D20): no profile document means a first Google
          // sign-in or an account made before roles existed. Self-registration
          // is donor-only now, so the account is a donor — hospital and admin
          // documents already exist, and the rules freeze `role`, so this
          // cannot demote one.
          if (found) {
            if (current()) setProfile(found)
            return
          }
          // The sign-up screen writes the same document itself; if its write
          // already published, this read is stale and must not double-write.
          if (!current()) return
          const data = {
            role: DEFAULT_ROLE,
            name: snap.displayName ?? '',
            email: snap.email ?? '',
          }
          try {
            await writeProfile(snap.uid, data)
            if (current()) publishProfile(data)
          } catch {
            // The write was refused (offline, rules): leave the profile missing
            // so guards report a broken account rather than guessing.
            if (current()) setProfile(null)
          }
        })
        .catch(() => {
          // Unreadable (offline, rules) is not the same as no profile: treat it
          // as missing so the guards retry rather than the app guessing a role,
          // and deliberately do not auto-provision on a failed read.
          if (current()) setProfile(null)
        })
        .finally(() => {
          if (current()) setRoleLoading(false)
        })
    })
    return () => stop?.()
  }, [publishProfile])

  const signIn = useCallback(
    (email, password) => signInWithEmail(email, password),
    [],
  )

  /**
   * Create the account and its donor profile (D20: self-registration is
   * donor-only; hospital and admin accounts are made by the Dugo+ team).
   *
   * `createAccount` publishes the snapshot itself, because `updateProfile()`
   * does not notify `onAuthStateChanged`. It writes no Firestore document:
   * the session event it triggers starts a profile read, and publishing the
   * profile from here is what marks that read stale.
   */
  const signUp = useCallback(
    async (name, email, password) => {
      const next = await createAccount(name, email, password, (fresh) =>
        setUser(snapshot(fresh)),
      )
      const data = {
        role: DEFAULT_ROLE,
        name: name ?? '',
        email: next.email ?? '',
      }
      try {
        await writeProfile(next.uid, data)
        publishProfile(data)
      } catch {
        // The account exists but `users/{uid}` was never written. Rethrow with
        // a marker the register screen recognises: it reports "account
        // created, profile not saved" and links to sign-in — retrying the form
        // would only hit "email already in use". The next sign-in auto-
        // provisions the donor profile (D20), so signing in again recovers.
        const error = new Error('The donor profile could not be saved.')
        error.roleNotSaved = true
        throw error
      }
      return next
    },
    [publishProfile],
  )

  const signInWithGoogle = useCallback(() => signInWithGooglePopup(), [])
  const signOut = useCallback(() => signOutOfFirebase(), [])

  /**
   * Re-read the user from Firebase (refreshing `emailVerified`) and publish it,
   * so the verify screen can confirm the emailed link without a hard reload.
   */
  const reloadUser = useCallback(async () => {
    const fresh = await reloadCurrentUser()
    setUser(snapshot(fresh))
    return snapshot(fresh)
  }, [])

  const resendVerification = useCallback(() => sendVerificationEmail(), [])

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
      signInWithGoogle,
      signOut,
      reloadUser,
      resendVerification,
    }),
    [
      user,
      loading,
      profile,
      roleLoading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      reloadUser,
      resendVerification,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
