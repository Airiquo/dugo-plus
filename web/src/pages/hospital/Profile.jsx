import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import { Card, PageHeader, ProfilePhotoEditor } from '../../components'

/** The signed-in hospital staff account and its profile picture, at `/hospital/profile`. */
export default function Profile() {
  const { user, profile, roleLoading } = useAuth()
  return <HospitalShell>
    <PageHeader tag="Dugo+ hospital" title="My profile" />
    <div id="page-body">
      <Card className="hospital-profile-card">
        <header><p className="care-kicker">Your hospital account</p><h2>A familiar face for your team.</h2><p className="muted">Your picture belongs to your account. Your facility’s details are managed separately.</p></header>
        <ProfilePhotoEditor disabled={roleLoading || !profile} />
        <dl className="admin-profile-facts">
          <div><dt>Name</dt><dd>{profile?.fullName || user?.displayName || '—'}</dd></div>
          <div><dt>Sign-in email</dt><dd>{user?.email || '—'}</dd></div>
          <div><dt>Account type</dt><dd>Hospital / Blood Bank</dd></div>
        </dl>
      </Card>
    </div>
  </HospitalShell>
}
