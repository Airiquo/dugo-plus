import { AppShell } from '../../layout/AppShell'
import { DashboardBody } from './DashboardBody'
/**
 * Dashboard — the admin dashboard.
 *
 * The body was seeded from `light/admin-dashboard.html` (see tools/gen_pages.py)
 * and is now normal, editable source: restructure or recompose it as the screen
 * needs, keeping the look the design system defines. New screens can compose
 * web/src/components directly; this one doubles as a full-page example.
 */
export default function Dashboard() {
  return (
    <AppShell>
      <DashboardBody />
    </AppShell>
  )
}
