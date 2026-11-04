import { HospitalShell } from '../../layout/HospitalShell'
import { AccountSettings, HospitalPageHeader } from '../../components'
import Profile from './Profile'

/** Hospital settings keep personal identity separate from facility details. */
export default function Settings() {
  return <HospitalShell><HospitalPageHeader title="Settings" eyebrow="Your account" description="Your personal details and display preferences." /><AccountSettings name="hospital-settings"><Profile embedded /></AccountSettings></HospitalShell>
}
