import { lazy, Suspense } from 'react'
import { NavigationTransitions } from './layout/NavigationTransitions'
import { RouteSkeleton } from './components/RouteSkeleton'
import { routeLoaders } from './utils/routeModules'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import RequireAuth from './layout/RequireAuth'
import RequireRole from './layout/RequireRole'
import RequireVerified from './layout/RequireVerified'
import { isFirebaseConfigured, missingFirebaseKeys } from './lib/firebase'
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Register from './pages/public/Register'






























import NotConfigured from './pages/shared/NotConfigured'
import { NAV } from './layout/AppShell'

const Partner = lazy(routeLoaders.Partner)
const ForgotPassword = lazy(routeLoaders.ForgotPassword)
const VerifyEmail = lazy(routeLoaders.VerifyEmail)
const PrivacyPolicy = lazy(routeLoaders.PrivacyPolicy)
const NotFound = lazy(routeLoaders.NotFound)
const Welcome = lazy(routeLoaders.Welcome)
const Dashboard = lazy(routeLoaders.Dashboard)
const BloodRequests = lazy(routeLoaders.BloodRequests)
const AuditTrail = lazy(routeLoaders.AuditTrail)
const AdminAccounts = lazy(routeLoaders.AdminAccounts)
const AdminSettings = lazy(routeLoaders.AdminSettings)
const AdminDataRequests = lazy(routeLoaders.AdminDataRequests)
const Profile = lazy(routeLoaders.Profile)
const HospitalProfile = lazy(routeLoaders.HospitalProfile)
const DonorSettings = lazy(routeLoaders.DonorSettings)
const Activity = lazy(routeLoaders.Activity)
const DonorPrivacy = lazy(routeLoaders.DonorPrivacy)
const Requests = lazy(routeLoaders.Requests)
const Alerts = lazy(routeLoaders.Alerts)
const HospitalRequests = lazy(routeLoaders.HospitalRequests)
const NewRequest = lazy(routeLoaders.NewRequest)
const HospitalDashboard = lazy(routeLoaders.HospitalDashboard)
const Inventory = lazy(routeLoaders.Inventory)
const HospitalMap = lazy(routeLoaders.HospitalMap)
const HospitalSettings = lazy(routeLoaders.HospitalSettings)
const HospitalFacility = lazy(routeLoaders.HospitalFacility)
const InventoryLog = lazy(routeLoaders.InventoryLog)
const HospitalDonors = lazy(routeLoaders.HospitalDonors)
const Gallery = lazy(routeLoaders.Gallery)
const ScreenStub = lazy(routeLoaders.ScreenStub)

/** Slugs that have a real page; every other admin screen renders `ScreenStub`. */
const TRANSLATED = new Set([
  'dashboard',
  'blood-requests',
  'audit-trail',
  'profile',
  'accounts',
  'settings',
  'data-requests',
  'inventory',
  'inventory-log',
])

/**
 * Top-level routes.
 *
 * With no `VITE_FIREBASE_*` configured, nothing is routed: the shell renders
 * `NotConfigured` instead, because sessions and account types live in Firebase
 * and there is no demo mode any more.
 *
 * Known admin screens: 12. `dashboard`, `blood-requests`, `profile`, `accounts`,
 * `settings`, `data-requests`, and `inventory` are built; the rest render a `ScreenStub`
 * pointing at the live mockups served from `/mockups/*`.
 *
 * `/admin/*` sits behind three gates, in order: `RequireAuth` checks there is a
 * session, `RequireVerified` checks the address is confirmed (D5), and
 * `RequireRole` checks the account type is `admin`. Self-registration is
 * donor-only (D20): a session with no profile document is provisioned as a
 * donor in `hooks/useAuth.jsx`, and `/partner` is how a facility requests a
 * hospital account. `/login` and `/register` have no mockup of their own and
 * are built on `AuthLayout`.
 *
 * `/hospital/*` repeats the same gates with `role === 'hospital'`. The
 * dashboard is the account's landing; the facility profile (FR-013) is the
 * first editable screen.
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
        <NavigationTransitions><Suspense fallback={<RouteSkeleton />}><Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/news/:slug" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* The consent and data-handling notice (FR-019); registration links
              here before the account is created. */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          {/* Public partnership intake (D21): the form posts to Formspree and
              emails the partners mailbox; hospital accounts are created by the
              Dugo+ team from those requests. */}
          <Route path="/partner" element={<Partner />} />
          {/* Password recovery (FR-48): donor/hospital/recipient only — admin
              accounts are premade and managed by the development team. */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Email-confirmation notice for accounts that have not clicked the
              link sent at registration (FR-01, NFR-12). Behind `RequireAuth`
              only for the suspension gate: an unverified account can be
              suspended too (D26), and it should stop at the blocked screen
              rather than keep requesting links. */}
          <Route
            path="/verify-email"
            element={
              <RequireAuth>
                <VerifyEmail />
              </RequireAuth>
            }
          />
          {/* Self-forwarding landing for donor/hospital accounts (see
              pages/shared/Welcome.jsx); homeFor() in services/users.js points
              them here until those screens exist. */}
          <Route
            path="/welcome"
            element={
              <RequireAuth>
                <Welcome />
              </RequireAuth>
            }
          />
          {/* Donor surface (FR-04). Donor accounts have no AppShell, so this
              sits behind the session + account-type gates only. */}
          <Route
            path="/donor/settings"
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['donor']}>
                    <DonorSettings />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          />
          <Route
            path="/donor/activity"
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['donor']}>
                    <Activity />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          />
          <Route path="/home" element={<RequireAuth><RequireVerified><RequireRole roles={['donor']}><Profile /></RequireRole></RequireVerified></RequireAuth>} />
          <Route path="/donor/profile" element={<Navigate to="/home" replace />} />
          {/* Donor blood requests (FR-005/006/022/023/028/029/030/038). */}
          <Route
            path="/donor/requests"
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['donor']}>
                    <Requests />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          />
          <Route
            path="/donor/alerts"
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['donor']}>
                    <Alerts />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          />
          {/* Hospital / blood-bank surface (FR-011, FR-016, FR-017): post and
              track the facility's requests. Same gates as admin; the pages
              render `HospitalShell`, not the admin `AppShell`. */}
          <Route
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['admin']}>
                    <Outlet />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          >
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/blood-requests" element={<BloodRequests />} />
            <Route path="/admin/audit-trail" element={<AuditTrail />} />
            <Route path="/admin/profile" element={<Navigate to="/admin/settings" replace />} />
            <Route path="/admin/accounts" element={<AdminAccounts />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/data-requests" element={<AdminDataRequests />} />
            <Route path="/admin/inventory" element={<Inventory />} />
            <Route path="/admin/inventory-log" element={<InventoryLog />} />
            {NAV.filter((item) => !TRANSLATED.has(item.slug)).map((item) => (
              <Route
                key={item.slug}
                path={`/admin/${item.slug}`}
                element={<ScreenStub slug={item.slug} />}
              />
            ))}
          </Route>
          <Route
            path="/donor/privacy"
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['donor']}>
                    <Navigate to="/donor/settings?tab=privacy" replace />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <RequireVerified>
                  <RequireRole roles={['hospital']}>
                    <Outlet />
                  </RequireRole>
                </RequireVerified>
              </RequireAuth>
            }
          >
            <Route path="/hospital" element={<Navigate to="/hospital/dashboard" replace />} />
            <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
            <Route path="/hospital/requests" element={<HospitalRequests />} />
            <Route path="/hospital/requests/new" element={<NewRequest />} />
            <Route path="/hospital/inventory" element={<Inventory />} />
            <Route path="/hospital/inventory-log" element={<InventoryLog />} />
            <Route path="/hospital/donors" element={<HospitalDonors />} />
            <Route path="/hospital/map" element={<HospitalMap />} />
            <Route path="/hospital/settings" element={<HospitalSettings />} />
            <Route path="/hospital/profile" element={<HospitalProfile />} />
            <Route path="/hospital/facility" element={<Navigate to="/hospital/settings?tab=facility" replace />} />
          </Route>
          <Route path="/gallery" element={<Gallery />} />
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense></NavigationTransitions>
      </AuthProvider>
    </ThemeProvider>
  )
}
