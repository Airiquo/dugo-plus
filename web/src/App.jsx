import { Outlet, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import RequireAuth from './layout/RequireAuth'
import RequireRole from './layout/RequireRole'
import { isFirebaseConfigured, missingFirebaseKeys } from './lib/firebase'
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Register from './pages/public/Register'
import PickRole from './pages/public/PickRole'
import NotFound from './pages/public/NotFound'
import Welcome from './pages/shared/Welcome'
import Dashboard from './pages/admin/Dashboard'
import BloodRequests from './pages/admin/BloodRequests'
import Gallery from './pages/shared/Gallery'
import ScreenStub from './pages/shared/ScreenStub'
import NotConfigured from './pages/shared/NotConfigured'
import { NAV } from './layout/AppShell'

/** Slugs that have a real page; every other admin screen renders `ScreenStub`. */
const TRANSLATED = new Set(['dashboard', 'blood-requests'])

/**
 * Top-level routes.
 *
 * With no `VITE_FIREBASE_*` configured, nothing is routed: the shell renders
 * `NotConfigured` instead, because sessions and account types live in Firebase
 * and there is no demo mode any more.
 *
 * Known admin screens: 9. `dashboard` and `blood-requests` are built; the rest
 * render a `ScreenStub` pointing at the live mockups served from `/mockups/*`.
 *
 * `/admin/*` sits behind two gates, in order: `RequireAuth` checks there is a
 * session, `RequireRole` checks the account type is `admin`. Accounts with no
 * role yet are sent to `/account/role` rather than refused. `/login` and
 * `/register` have no mockup of their own and are built on `AuthLayout`.
 */
export default function App() {
  // `NotConfigured` wears `AuthLayout`, so it still needs the theme context even
  // though there are no routes (and no session to check) yet.
  if (!isFirebaseConfigured)
    return (
      <ThemeProvider>
        <NotConfigured missing={missingFirebaseKeys} />
      </ThemeProvider>
    )

  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account/role" element={<PickRole />} />
          {/* Self-forwarding landing for donor/hospital accounts (see
              pages/shared/Welcome.jsx); homeFor() in services/users.js points
              them here until those screens exist. */}
          <Route path="/welcome" element={<Welcome />} />
          <Route
            element={
              <RequireAuth>
                <RequireRole roles={['admin']}>
                  <Outlet />
                </RequireRole>
              </RequireAuth>
            }
          >
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/blood-requests" element={<BloodRequests />} />
            {NAV.filter((item) => !TRANSLATED.has(item.slug)).map((item) => (
              <Route
                key={item.slug}
                path={`/admin/${item.slug}`}
                element={<ScreenStub slug={item.slug} />}
              />
            ))}
          </Route>
          <Route path="/gallery" element={<Gallery />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
