import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import BloodRequests from './pages/BloodRequests'
import Gallery from './pages/Gallery'
import ScreenStub from './pages/ScreenStub'
import NotFound from './pages/NotFound'
import { NAV } from './layout/AppShell'
/** Slugs that have a real page; every other admin screen renders `ScreenStub`. */
const TRANSLATED = new Set(['dashboard', 'blood-requests'])
/**
 * Top-level routes.
 *
 * Known admin screens: 9. `dashboard` and `blood-requests` are translated; the
 * remaining admin screens render a `ScreenStub` pointing to the live mockups
 * served at `/mockups/light/*` and `/mockups/dark/*`.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/blood-requests" element={<BloodRequests />} />
        {NAV.filter((item) => !TRANSLATED.has(item.slug)).map((item) => (
          <Route
            key={item.slug}
            path={`/admin/${item.slug}`}
            element={<ScreenStub slug={item.slug} />}
          />
        ))}
        <Route path="/gallery" element={<Gallery />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  )
}
