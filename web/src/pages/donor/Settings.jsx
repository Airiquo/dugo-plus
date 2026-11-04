import { useTheme } from '../../hooks/useTheme'
import { DonorNav } from '../../layout/DonorNav'
import { AccountSettings, CarePageHeader, SupportContact } from '../../components'
import Profile from './Profile'

/** Donor account settings retain the existing personal-details form. */
export default function Settings() {
  const { theme } = useTheme()
  return <div className="pub donor-surface" data-theme={theme}><DonorNav /><main id="top" className="donor-main settings-main"><CarePageHeader kicker="Your account" title="Settings" description="Your details, your appearance, your space." /><AccountSettings name="donor-settings"><Profile embedded /></AccountSettings><SupportContact as="footer" /></main></div>
}
