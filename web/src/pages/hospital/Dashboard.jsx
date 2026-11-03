import { TableExport } from '../../components/TableExport'
import { donationReportColumns } from '../../utils/reportColumns'
import { allHospitalDonations } from '../../services/tableExports'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getHospitalDonations, readHospital } from '../../services/hospitals'
import { BLOOD_TYPES } from '../../services/users'
import { componentLabel } from '../../services/requests'
import { toDate } from '../../utils/eligibility'
import { HospitalShell } from '../../layout/HospitalShell'
import { Badge, Card, PageHeader, Table, TablePager } from '../../components'

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
  const [page, setPage] = useState(1)
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

    const loadDonations = async () => {
      const rows = []
      let cursor = null
      do {
        const result = await getHospitalDonations(hospitalId, { since, cursor, limit: 100 })
        if (!current) return { rows: [] }
        rows.push(...result.rows)
        cursor = result.cursor
      } while (cursor)
      return { rows }
    }
    loadDonations()
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
                  <label className="hospital-period-select">
                    <span className="care-sr-only">Collection period</span>
                    <select
                      aria-label="Collection period"
                      value={period}
                      onChange={(event) => { setPeriod(event.target.value); setPage(1) }}
                    >
                      {PERIOD_TABS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
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
                      <TableExport name="collections" title={`${hospital?.name || "Facility"} blood collections`} columns={donationReportColumns} disabled={donationsLoading || donationsFailed || !hospitalId} getRows={(scope, progress) => scope === 'filtered' ? donations : allHospitalDonations(hospitalId, {}, progress)} />
                      {donations.length === 0 ? (
                        <p className="hospital-state" data-kind="warn" role="status">
                          No blood units collected at this facility during this period.
                        </p>
                      ) : (
                        <>
                        <Table
                      mobileCards
                          className="hospital-table"
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
                            { key: 'component', header: 'Component', render: row => row.component ? componentLabel(row.component) : 'Unclassified' },
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
                          rows={donations.slice((page - 1) * 10, page * 10)}
                          rowKey={(row) => row.id}
                          scroll={false}
                        />
                        <TablePager page={page} pageCount={Math.max(1, Math.ceil(donations.length / 10))} onPage={setPage}
                          total={donations.length} rangeStart={(page - 1) * 10 + 1} rangeEnd={Math.min(page * 10, donations.length)} />
                        </>
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
