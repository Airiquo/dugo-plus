import { HospitalShell } from '../../layout/HospitalShell'
import { AccountSettings, HospitalPageHeader } from '../../components'
import Facility from './Facility'

/** Hospital settings keep personal identity separate from facility details. */
export default function Settings() {
  return <HospitalShell><HospitalPageHeader title="Settings" eyebrow="Your account" description="Your facility details and display preferences." /><AccountSettings name="hospital-settings" profile={false} sections={[{ id: "facility", label: "Facility details", icon: "hospital", content: <Facility embedded /> }]} /></HospitalShell>
}
