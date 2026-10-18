import { AppShell } from '../../layout/AppShell'
import { DashboardBody } from './DashboardBody'
/**
 * Dashboard — the translated admin-dashboard mockup.
 *
 * The body is a faithful, generated translation of `light/admin-dashboard.html`
 * (see tools/gen_pages.py) so it matches the mockup pixel-for-pixel. New screens
 * should be built from web/src/components instead; this one doubles as the
 * reference for what the design system looks like in full.
 */
export default function Dashboard() {
  return (
    <AppShell>
      <DashboardBody />
    </AppShell>
  )
}
