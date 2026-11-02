import { useEffect, useState } from 'react'
import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import { fetchHospital } from '../../services/requests'
import { asPoint } from '../../utils/geo'
import { Btn, Card, HospitalLocationMap, Icon, PageHeader, ProfilePhotoEditor } from '../../components'

/** Hospital staff identity and the linked facility's read-only saved location. */
export default function Profile() {
  const { user, profile, roleLoading } = useAuth()
  const [facility, setFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (roleLoading) return
    let active = true
    setLoading(true); setError(''); setFacility(null)
    fetchHospital(profile?.hospitalId).then((found) => {
      if (!active) return
      if (!found) setError('No facility is linked to this account. Contact your administrator.')
      else setFacility(found)
    }).catch(() => { if (active) setError('Your facility details could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profile?.hospitalId, roleLoading, attempt])
  const position = asPoint(facility?.latitude, facility?.longitude)
  return <HospitalShell>
    <PageHeader tag="Dugo+ hospital" title="My profile" />
    <div id="page-body">
      <div className="hospital-profile-grid"><Card className="hospital-profile-card">
        <header><p className="care-kicker">Your hospital account</p><h2>A familiar face for your team.</h2><p className="muted">Your picture belongs to your account. Your facility’s details are managed separately.</p></header>
        <ProfilePhotoEditor disabled={roleLoading || !profile} />
        <dl className="admin-profile-facts">
          <div><dt>Name</dt><dd>{profile?.fullName || user?.displayName || '—'}</dd></div>
          <div><dt>Sign-in email</dt><dd>{user?.email || '—'}</dd></div>
          <div><dt>Account type</dt><dd>Hospital / Blood Bank</dd></div>
        </dl>
      </Card>
      <Card className="hospital-facility-card">
        <header><div><p className="care-kicker">Your facility</p><h2>{facility?.name || 'Hospital location'}</h2></div>
          <span className="hospital-location-locked"><Icon name="lock" size={14} />Locked</span></header>
        <p className="muted">Your saved facility location helps donors find you. Contact your Dugo+ administrator to correct it.</p>
        {loading && <p role="status">Loading your facility…</p>}
        {error && <div role="alert"><p data-state="error">{error}</p><Btn onClick={() => setAttempt((value) => value + 1)}>Try again</Btn></div>}
        {facility && <>
          {position ? <HospitalLocationMap position={position} label={`${facility.name} saved location`} />
            : <div className="hospital-location-empty"><Icon name="pin" size={24} /><h3>No map pin saved yet</h3>
              <p>Your administrator can pin the facility from Accounts.</p></div>}
          <dl className="hospital-location-facts">
            <div><dt>Facility address</dt><dd>{facility.address || 'Not recorded'}</dd></div>
            <div><dt>City</dt><dd>{facility.city || profile?.city || 'Not recorded'}</dd></div>
            <div><dt>Latitude</dt><dd>{position ? position.lat.toFixed(6) : 'Not recorded'}</dd></div>
            <div><dt>Longitude</dt><dd>{position ? position.lng.toFixed(6) : 'Not recorded'}</dd></div>
            <div><dt>Facility contact</dt><dd>{facility.contactNumber || 'Not recorded'}</dd></div>
          </dl>
        </>}
      </Card></div>
    </div>
  </HospitalShell>
}
