import { Link } from 'react-router-dom'
import { AppShell } from '../../layout/AppShell'
import { CarePageHeader, Icon } from '../../components'

const destinations = [
  { to: 'accounts', icon: 'user', title: 'People & facilities', text: 'Manage hospital and donor account access to the platform.' },
  { to: 'data-requests', icon: 'file', title: 'Privacy, put into practice', text: 'Review the access, correction and erasure requests that need your attention.' },
  { to: 'audit-trail', icon: 'check', title: 'An accountable connection', text: 'Inspect the audit trail and verify the integrity of recorded events.' },
  { to: 'settings', icon: 'settings', title: 'A system that connects', text: 'Configure matching radius tiers and notification retries.' },
]
/** Admin entry points to the existing account, privacy, audit and settings tools. */
export default function Dashboard() {
  return <AppShell><CarePageHeader kicker="Dugo+ administration" title={<>Care, coordinated.<br /><em>Trust, maintained.</em></>} description="The people, permissions and safeguards behind every connection." /><div className="care-admin-launchpad">{destinations.map(item => <Link key={item.to} to={`/admin/${item.to}`} className="card care-launch-card"><span className="care-launch-icon"><Icon name={item.icon} size={26} /></span><h2>{item.title}</h2><p>{item.text}</p><span className="care-launch-link">Open workspace<Icon name="arrow-right" /></span></Link>)}</div></AppShell>
}
