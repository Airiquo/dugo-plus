import { useEffect, useState } from 'react'
import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import { readHospital } from '../../services/hospitals'
import { asPoint } from '../../utils/geo'
import { Btn, Card, HospitalLocationMap, PageHeader } from '../../components'

/** Staff view of the administrator-managed facility pin. */
export default function HospitalMap() {
  const { profile, roleLoading } = useAuth()
  const [hospital, setHospital] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (roleLoading) return
    let current = true
    setLoading(true)
    setError('')
    setHospital(null)
    readHospital(profile?.hospitalId).then(found => {
      if (!current) return
      if (!found) setError('No facility is linked to this account. Contact your administrator.')
      else setHospital(found)
    }).catch(() => {
      if (current) setError('Your facility location could not be loaded. Try again.')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [profile?.hospitalId, roleLoading, attempt])
  const position = asPoint(hospital?.latitude, hospital?.longitude)
  return <HospitalShell facility={hospital?.name}>
    <PageHeader tag="Hospital workspace" title="Hospital map" />
    <div id="page-body"><Card className="hospital-facility-card">
      <header><div><p className="care-kicker">Your facility</p><h2>{hospital?.name || 'Saved location'}</h2></div><span className="hospital-location-locked">Admin managed</span></header>
      <p className="muted">This is the saved location used for nearby donor matching. Contact your administrator to correct the address or pin.</p>
      {loading && <p role="status">Loading facility location…</p>}
      {error && <div role="alert"><p>{error}</p><Btn onClick={() => setAttempt(value => value + 1)}>Try again</Btn></div>}
      {!loading && !error && <>
        {position ? <HospitalLocationMap position={position} /> : <p className="hospital-location-empty" role="status">No location has been recorded. Ask your administrator to pin the facility.</p>}
        <dl className="hospital-location-facts"><div><dt>Address</dt><dd>{hospital?.address || 'Not recorded'}</dd></div><div><dt>Latitude</dt><dd>{position?.lat ?? 'Not recorded'}</dd></div><div><dt>Longitude</dt><dd>{position?.lng ?? 'Not recorded'}</dd></div></dl>
      </>}
    </Card></div>
  </HospitalShell>
}
