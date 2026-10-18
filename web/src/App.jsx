import { Outlet, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import RequireAuth from './layout/RequireAuth'
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Register from './pages/public/Register'
import NotFound from './pages/public/NotFound'
import Dashboard from './pages/admin/Dashboard'
import BloodRequests from './pages/admin/BloodRequests'
import Gallery from './pages/shared/Gallery'
import ScreenStub from './pages/shared/ScreenStub'
import { NAV } from './layout/AppShell'
/** Slugs that have a real page; every other admin screen renders `ScreenStub`. */
const TRANSLATED = new Set(['dashboard', 'blood-requests'])
/**
 * Top-level routes.
 *
 * Known admin screens: 9. `dashboard` and `blood-requests` are translated; the
 * remaining admin screens render a `ScreenStub` pointing to the live mockups
 * served at `/mockups/light/*` and `/mockups/dark/*`.
 *
 * The admin routes sit behind `RequireAuth`, which only enforces a session when
 * `VITE_FIREBASE_*` is configured — an unconfigured clone renders them freely.
 * `/login` and `/register` are the two screens with no mockup of their own; both
 * are built from the landing page's designed sign-in band (see `AuthLayout`).
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <RequireAuth>
                <Outlet />
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
