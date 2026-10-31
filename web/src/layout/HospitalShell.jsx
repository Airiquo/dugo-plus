import { AppShell } from './AppShell'

/** Hospital and blood-bank navigation. */
export const HOSPITAL_NAV = [
  { slug: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { slug: 'inventory', label: 'Inventory', icon: 'box' },
  { slug: 'map', label: 'Hospital Map', icon: 'map' },
  { slug: 'profile', label: 'Facility profile', icon: 'settings' },
]

/**
 * Hospital / blood-bank chrome: the shared sidebar with the facility nav.
 *
 * @param {string} [facility] - the signed-in account's facility name, shown as
 *   the sidebar pill; omitted until the hospital document has loaded.
 */
export function HospitalShell({ children, facility }) {
  return (
    <AppShell nav={HOSPITAL_NAV} basePath="/hospital" facility={facility ?? ''}>
      {children}
    </AppShell>
  )
}
