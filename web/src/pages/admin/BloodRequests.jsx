import { AppShell } from '../../layout/AppShell'
/**
 * Blood Requests — `/admin/blood-requests`.
 *
 * Content removed by the owner's direction (the seeded list screen is gone);
 * the route stays so navigation and the shell keep working. The data layer it
 * rendered from — `web/src/services/requests.js` — is untouched and is what a
 * rebuilt screen should read from. The reference mockups
 * (`light/admin-blood-requests.html`, `dark/`) remain the look reference.
 */
export default function BloodRequests() {
  return <AppShell />
}
