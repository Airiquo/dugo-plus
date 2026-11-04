import { useTheme } from '../../hooks/useTheme'
import { DonorNav } from '../../layout/DonorNav'
import { AccountSettings, CarePageHeader, SupportContact } from '../../components'
import Privacy from './Privacy'

/** Donor account settings retain the existing personal-details form. */
export default function Settings() {
  const { theme } = useTheme()
  return <div className="pub donor-surface" data-theme={theme}><DonorNav /><main id="top" className="donor-main settings-main"><CarePageHeader kicker="Your account" title="Settings" description="Your appearance, privacy and data requests." /><AccountSettings name="donor-settings" profile={false} sections={[{ id: "privacy", label: "Privacy", icon: "shield", content: <Privacy embedded /> }]} /><SupportContact as="footer" /></main></div>
}
