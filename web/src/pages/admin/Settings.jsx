import { AppShell } from '../../layout/AppShell'
import { AccountSettings, PageHeader } from '../../components'
import Profile from './Profile'

/** Administrator settings compose personal details and appearance. */
export default function Settings() {
  return <AppShell><div className="admin-workspace"><PageHeader title="Settings" /><AccountSettings name="admin-settings"><Profile embedded /></AccountSettings></div></AppShell>
}
