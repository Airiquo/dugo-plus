import { Link, Navigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { roleLabel } from '../../services/users'
import { PubThemeToggle } from '../../components'

/**
 * "You're in" notice — where hospital accounts land.
 *
 * A normal route rather than a guarded one, so it can forward itself: an admin
 * who ends up here goes straight on to the dashboard, a donor to their profile,
 * a hospital account to its requests screen (F3), and signing out drops back on
 * the public landing page rather than the sign-in form. No account type lands
 * here from `homeFor()` any more; it remains for a misdirected session and for
 * account types that gain screens later.
 *
 * No `AppShell`: that chrome is the admin area's. Composed from the same
 * public classes the auth screens use, inside the `.pub` theme scope, so both
 * themes carry it unchanged. The centring is the one-off inline layout also
 * used by `RequireAuth`/`RequireRole`, since no design-system class centres a
 * bare page.
 */
export default function Welcome() {
  const { theme } = useTheme()
  const { user, loading, role, roleLoading, signOut } = useAuth()

  if (loading || roleLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p className="pub-msg">Checking account…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />
  // No profile document: the auto-provision write failed (D20). Land on the
  // landing page rather than looping between guards.
  if (!role) return <Navigate to="/" replace />
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (role === 'donor') return <Navigate to="/home" replace />
  if (role === 'hospital') return <Navigate to="/hospital/requests" replace />

  const label = roleLabel(role)

  return (
    <div
      className="pub"
      data-theme={theme}
      // Two rows (nav, then the notice filling what's left) so the card
      // centres vertically without measuring the nav's height.
      style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}
    >
      <header className="pub-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            Dugo<span>+</span>
          </span>
        </Link>
        <nav aria-label="Sections">
          <Link to="/">Home</Link>
        </nav>
        <div className="pub-nav-end">
          <PubThemeToggle />
        </div>
      </header>
      <main id="top" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="pub-card pub-form" style={{ maxWidth: 460, width: '100%' }}>
          <p className="pub-kicker">Signed in</p>
          <h3>You're in</h3>
          <p className="pub-muted">
            {user.email ?? 'Your account'} is signed in as a <strong>{label}</strong> account.
          </p>
          <p className="pub-muted">
            The hospital screens are still being built. This is where they will open. Your account
            is ready.
          </p>
          <Link className="pub-btn pub-btn-wide" to="/">
            Back to Dugo+
          </Link>
          <button className="pub-btn pub-btn-ghost pub-btn-wide" type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
