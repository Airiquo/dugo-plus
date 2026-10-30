import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { readHospital } from '../../services/hospitals'
import { HospitalShell } from '../../layout/HospitalShell'
import { Badge, Card, PageHeader } from '../../components'

/** The status tone for a facility badge. */
function statusTone(status) {
  if (status === 'Active') return 'active'
  if (status === 'Suspended') return 'warning'
  return 'inactive'
}

/**
 * Hospital dashboard — `/hospital/dashboard`.
 *
 * Initial hospital layout: the facility summary staff land on after sign-in.
 * The F6 analytics and inventory panels replace the body later; this screen
 * only carries real values from `hospitals/{hospitalId}` (schema §2.3).
 */
export default function Dashboard() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [hospital, setHospital] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false)
      return undefined
    }
    let current = true
    setLoading(true)
    setLoadFailed(false)
    readHospital(hospitalId)
      .then((found) => {
        if (current) setHospital(found)
      })
      .catch(() => {
        if (current) setLoadFailed(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [hospitalId])

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader tag="Dugo+ hospital" title="Dashboard" />
      <div id="page-body">
        <section className="hospital-overview">
          <Card>
            <header>
              <h2>Facility</h2>
              <p className="muted">
                The facility your account acts for. Details are edited on the facility profile.
              </p>
            </header>

            {loading && <p className="hospital-state">Loading facility…</p>}

            {!loading && !hospitalId && (
              <p className="hospital-state" data-kind="warn" role="status">
                This account is not linked to a facility yet. Ask an administrator to set your
                hospital, then reload.
              </p>
            )}

            {!loading && hospitalId && loadFailed && (
              <p className="hospital-state" data-kind="error" role="alert">
                Your facility could not be loaded. Check your connection and reload the page.
              </p>
            )}

            {!loading && hospitalId && !loadFailed && !hospital && (
              <p className="hospital-state" data-kind="warn" role="status">
                No facility record was found for this account. Ask an administrator to check the
                link.
              </p>
            )}

            {hospital && (
              <dl className="hospital-facts">
                <div>
                  <dt>Name</dt>
                  <dd>{hospital.name || '—'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{hospital.address || '—'}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{hospital.contactNumber || '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Badge data-status={statusTone(hospital.status)}>
                      {hospital.status || 'Unknown'}
                    </Badge>
                  </dd>
                </div>
              </dl>
            )}
          </Card>
        </section>
      </div>
    </HospitalShell>
  )
}
