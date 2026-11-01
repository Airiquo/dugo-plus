import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getHospitalDonations, readHospital } from '../../services/hospitals'
import { BLOOD_TYPES } from '../../services/users'
import { toDate } from '../../utils/eligibility'
import { HospitalShell } from '../../layout/HospitalShell'
import { Badge, Card, PageHeader, Table, Tabs } from '../../components'

/** The status tone for a facility badge. */
function statusTone(status) {
  if (status === 'Active') return 'active'
  if (status === 'Suspended') return 'warning'
  return 'inactive'
}

/** Pre-set period filters for blood collection tracking (FR-014). */
const PERIOD_TABS = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
  { value: '1y', label: '1 year', days: 365 },
  { value: 'all', label: 'All time', days: null },
]

/** Formats a donation date for the history table. */
function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

/**
 * Hospital dashboard — `/hospital/dashboard`.
 *
 * Facility staff overview: facility profile details and total blood units
 * collected over selectable periods (FR-014).
 */
export default function Dashboard() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [hospital, setHospital] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const [period, setPeriod] = useState('30d')
  const [donations, setDonations] = useState([])
  const [donationsLoading, setDonationsLoading] = useState(true)
  const [donationsFailed, setDonationsFailed] = useState(false)

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

  useEffect(() => {
    if (!hospitalId) {
      setDonationsLoading(false)
      return undefined
    }
    let current = true
    setDonationsLoading(true)
    setDonationsFailed(false)

    const opt = PERIOD_TABS.find((p) => p.value === period) ?? PERIOD_TABS[1]
    const since = opt.days ? new Date(Date.now() - opt.days * 86400000) : null

    getHospitalDonations(hospitalId, { since, limit: 100 })
      .then((res) => {
        if (current) setDonations(res.rows)
      })
      .catch(() => {
        if (current) setDonationsFailed(true)
      })
      .finally(() => {
        if (current) setDonationsLoading(false)
      })

    return () => {
      current = false
    }
  }, [hospitalId, period])

  const totalUnits = useMemo(
    () => donations.reduce((sum, d) => sum + (Number(d.units) || 0), 0),
    [donations],
  )

  const unitsByType = useMemo(() => {
    const counts = Object.fromEntries(BLOOD_TYPES.map((bt) => [bt, 0]))
    for (const d of donations) {
      if (d.bloodType && counts[d.bloodType] !== undefined) {
        counts[d.bloodType] += Number(d.units) || 0
      }
    }
    return counts
  }, [donations])

  const activeTypesCount = useMemo(
    () => Object.values(unitsByType).filter((units) => units > 0).length,
    [unitsByType],
  )

  const activePeriod = PERIOD_TABS.find((p) => p.value === period) ?? PERIOD_TABS[1]

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader tag="Dugo+ hospital" title="Dashboard" />
      <div id="page-body">
        <div className="hospital-dashboard">
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

          {hospitalId && (
            <section className="hospital-collections">
              <Card>
                <header className="hospital-collections-head">
                  <div>
                    <h2>Blood units collected</h2>
                    <p className="muted">
                      Total blood units collected across confirmed donations over the selected
                      period (FR-014).
                    </p>
                  </div>
                  <Tabs
                    label="Collection period"
                    tabs={PERIOD_TABS}
                    value={period}
                    onChange={setPeriod}
                  />
                </header>

                {donationsLoading && (
                  <p className="hospital-state">Loading collection metrics…</p>
                )}

                {!donationsLoading && donationsFailed && (
                  <p className="hospital-state" data-kind="error" role="alert">
                    Failed to load collection metrics. Check connection and reload.
                  </p>
                )}

                {!donationsLoading && !donationsFailed && (
                  <>
                    <div className="hospital-inventory-summary">
                      <Card>
                        <span>Total units collected</span>
                        <strong>
                          {totalUnits} <small>units</small>
                        </strong>
                        <small>
                          {donations.length} confirmed donation
                          {donations.length === 1 ? '' : 's'} in {activePeriod.label.toLowerCase()}
                        </small>
                      </Card>
                      <Card>
                        <span>Blood types collected</span>
                        <strong>
                          {activeTypesCount} <small>/ {BLOOD_TYPES.length} types</small>
                        </strong>
                        <small>
                          {activeTypesCount > 0
                            ? `${activeTypesCount} type${activeTypesCount === 1 ? '' : 's'} represented`
                            : 'No donations in period'}
                        </small>
                      </Card>
                      <Card>
                        <span>Period filter</span>
                        <strong className="hospital-inventory-last">{activePeriod.label}</strong>
                        <small>
                          {activePeriod.days
                            ? `Last ${activePeriod.days} days`
                            : 'Entire donation history'}
                        </small>
                      </Card>
                    </div>

                    <div className="hospital-collections-types">
                      <h3>Units by blood type</h3>
                      <div className="hospital-types-grid">
                        {BLOOD_TYPES.map((type) => {
                          const units = unitsByType[type] || 0
                          return (
                            <div
                              key={type}
                              className="hospital-type-chip"
                              data-empty={units === 0 ? 'true' : undefined}
                            >
                              <Badge>{type}</Badge>
                              <strong>{units}</strong>
                              <span>unit{units === 1 ? '' : 's'}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="hospital-collections-recent">
                      <h3>Recent collections in period</h3>
                      {donations.length === 0 ? (
                        <p className="hospital-state" data-kind="warn" role="status">
                          No blood units collected at this facility during this period.
                        </p>
                      ) : (
                        <Table
                          columns={[
                            {
                              key: 'donationDate',
                              header: 'Date & Time',
                              render: (row) => formatDate(row.donationDate),
                            },
                            {
                              key: 'bloodType',
                              header: 'Blood Type',
                              render: (row) => <Badge>{row.bloodType || '—'}</Badge>,
                            },
                            {
                              key: 'units',
                              header: 'Units',
                              render: (row) => (
                                <strong>
                                  {row.units} {row.units === 1 ? 'unit' : 'units'}
                                </strong>
                              ),
                            },
                            {
                              key: 'donor',
                              header: 'Donor',
                              render: (row) => row.donorName || row.donorId || '—',
                            },
                          ]}
                          rows={donations}
                          rowKey={(row) => row.id}
                        />
                      )}
                    </div>
                  </>
                )}
              </Card>
            </section>
          )}
        </div>
      </div>
    </HospitalShell>
  )
}
