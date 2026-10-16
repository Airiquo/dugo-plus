import { Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Gallery from './pages/Gallery'
import ScreenStub from './pages/ScreenStub'
import NotFound from './pages/NotFound'
import { NAV } from './layout/AppShell'
/**
 * Top-level routes.
 *
 * Known admin screens: 9. `/admin/dashboard` renders the faithful translation;
 * the remaining admin screens render a `ScreenStub` pointing to the live
 * mockups served at `/mockups/light/*` and `/mockups/dark/*`.
 */
export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        {NAV.slice(1).map((item) => (
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
