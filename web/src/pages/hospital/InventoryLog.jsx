import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getHospitalDonations,
  getInventoryLogs,
  listHospitals,
  readHospital,
} from '../../services/hospitals'
import { BLOOD_TYPES } from '../../services/users'
import { toDate } from '../../utils/eligibility'
import { AppShell } from '../../layout/AppShell'
import { HospitalShell } from '../../layout/HospitalShell'
import {
  Badge,
  Btn,
  Card,
  Field,
  PageHeader,
  Select,
  Table,
  TablePager,
  Tabs,
} from '../../components'

const HISTORY_PAGE = 50

/** Rows per page in the log tables. */
const PAGE_SIZE = 10

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All blood types' },
  ...BLOOD_TYPES.map((bt) => ({ value: bt, label: bt })),
]

function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

function shortId(value) {
  if (!value || typeof value !== 'string') return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

/**
 * Inventory log screen — `/hospital/inventory-log` for hospital staff (FR-020)
 * and `/admin/inventory-log` for administrators.
 *
 * Displays:
 * 1. Confirmed donations: every completed donation at this facility (schema §2.9).
 * 2. Stock movements: audit log of all stock changes (schema §2.3.3) across blood types.
 */
export default function InventoryLog() {
  const { profile, role } = useAuth()
  const isAdmin = role === 'admin'
  const staffHospitalId = profile?.hospitalId ?? ''

  const [facilities, setFacilities] = useState([])
  const [facilitiesLoading, setFacilitiesLoading] = useState(false)
  const [facilitiesFailed, setFacilitiesFailed] = useState(false)
  const [picked, setPicked] = useState('')

  const hospitalId = isAdmin ? picked : staffHospitalId

  const [hospital, setHospital] = useState(null)
  const [tab, setTab] = useState('donations')

  // Confirmed donations state
  const [donations, setDonations] = useState([])
  const [cursor, setCursor] = useState(null)
  const [donationsLoading, setDonationsLoading] = useState(true)
  const [donationsFailed, setDonationsFailed] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Stock movements state
  const [selectedType, setSelectedType] = useState('')
  const [movements, setMovements] = useState([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [movementsFailed, setMovementsFailed] = useState(false)

  // Table controls: per-tab blood-type filter (movements filter server-side),
  // date sort and client-side pagination.
  const [donFilterType, setDonFilterType] = useState('')
  const [donSort, setDonSort] = useState('new')
  const [donPage, setDonPage] = useState(1)
  const [movSort, setMovSort] = useState('new')
  const [movPage, setMovPage] = useState(1)

  const [reloadKey, setReloadKey] = useState(0)

  // Facility name for header and shell
  useEffect(() => {
    if (!hospitalId) return undefined
    let current = true
    readHospital(hospitalId)
      .then((found) => current && setHospital(found))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [hospitalId])

  // Admin facility list
  useEffect(() => {
    if (!isAdmin) return undefined
    let current = true
    setFacilitiesLoading(true)
    setFacilitiesFailed(false)
    listHospitals()
      .then((list) => {
        if (!current) return
        setFacilities(list)
        setPicked((prev) => prev || list[0]?.id || '')
      })
      .catch(() => current && setFacilitiesFailed(true))
      .finally(() => current && setFacilitiesLoading(false))
    return () => {
      current = false
    }
  }, [isAdmin, reloadKey])

  // Load confirmed donations
  useEffect(() => {
    if (!hospitalId) {
      setDonations([])
      setDonationsLoading(false)
      return undefined
    }
    let current = true
    setDonationsLoading(true)
    setDonationsFailed(false)
    setCursor(null)

    getHospitalDonations(hospitalId, { limit: HISTORY_PAGE })
      .then((page) => {
        if (!current) return
        setDonations(page.rows)
        setCursor(page.cursor)
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
  }, [hospitalId, reloadKey])

  // Load stock movements
  useEffect(() => {
    if (!hospitalId || tab !== 'movements') return undefined
    let current = true
    setMovementsLoading(true)
    setMovementsFailed(false)

    const typesToLoad = selectedType ? [selectedType] : BLOOD_TYPES

    Promise.allSettled(
      typesToLoad.map((bt) =>
        getInventoryLogs(hospitalId, bt, { limit: 50 }).then((logs) =>
          logs.map((item) => ({ ...item, bloodType: bt })),
        ),
      ),
    )
      .then((results) => {
        if (!current) return
        const allLogs = results
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
        setMovements(allLogs)
      })
      .catch(() => {
        if (current) setMovementsFailed(true)
      })
      .finally(() => {
        if (current) setMovementsLoading(false)
      })

    return () => {
      current = false
    }
  }, [hospitalId, selectedType, tab, reloadKey])

  const loadMoreDonations = async () => {
    if (!hospitalId || !cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await getHospitalDonations(hospitalId, { cursor, limit: HISTORY_PAGE })
      setDonations((prev) => [...prev, ...page.rows])
      setCursor(page.cursor)
    } catch {
      setDonationsFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const sortDate = (rows, key, dir) =>
    [...rows].sort(
      (a, b) => ((a[key]?.getTime?.() ?? 0) - (b[key]?.getTime?.() ?? 0)) * (dir === 'new' ? -1 : 1),
    )
  const donationRows = useMemo(
    () =>
      sortDate(
        donFilterType ? donations.filter((row) => row.bloodType === donFilterType) : donations,
        'donationDate',
        donSort,
      ),
    [donations, donFilterType, donSort],
  )
  const donationPageCount = Math.max(1, Math.ceil(donationRows.length / PAGE_SIZE))
  const donationCurrentPage = Math.min(donPage, donationPageCount)
  const donationPaged = donationRows.slice(
    (donationCurrentPage - 1) * PAGE_SIZE,
    donationCurrentPage * PAGE_SIZE,
  )
  const movementRows = useMemo(() => sortDate(movements, 'createdAt', movSort), [movements, movSort])
  const movementPageCount = Math.max(1, Math.ceil(movementRows.length / PAGE_SIZE))
  const movementCurrentPage = Math.min(movPage, movementPageCount)
  const movementPaged = movementRows.slice(
    (movementCurrentPage - 1) * PAGE_SIZE,
    movementCurrentPage * PAGE_SIZE,
  )

  const totals = useMemo(() => {
    const totalUnits = donations.reduce((sum, row) => sum + (Number(row.units) || 0), 0)
    const latest = donations.reduce((last, row) => {
      const date = toDate(row.donationDate)
      return date && (!last || date > last) ? date : last
    }, null)
    return { count: donations.length, totalUnits, latest }
  }, [donations])

  const Shell = isAdmin ? AppShell : HospitalShell

  return (
    <Shell facility={hospital?.name}>
      <PageHeader tag={isAdmin ? 'Dugo+ admin' : 'Dugo+ hospital'} title="Inventory Log" />
      <div id="page-body">
        <div className="hospital-inventory">
          {isAdmin && (
            <Card>
              <Field label="Facility">
                <Select
                  options={facilities.map((item) => ({ value: item.id, label: item.name }))}
                  value={picked}
                  onChange={(event) => setPicked(event.target.value)}
                  disabled={facilitiesLoading || facilitiesFailed}
                  aria-label="Facility"
                />
              </Field>
              {facilitiesLoading && <p className="hospital-state">Loading facilities…</p>}
              {!facilitiesLoading && facilitiesFailed && (
                <div role="alert">
                  <p className="hospital-state" data-kind="error">
                    The facility list could not be loaded.
                  </p>
                  <Btn onClick={() => setReloadKey((k) => k + 1)}>Try again</Btn>
                </div>
              )}
            </Card>
          )}

          {!hospitalId && !isAdmin && (
            <Card>
              <p className="hospital-state" data-kind="warn" role="status">
                This account is not linked to a facility yet. Ask an administrator to link your
                account.
              </p>
            </Card>
          )}

          {hospitalId && (
            <>
              <Tabs
                className="hospital-inventory-tabs"
                label="Log views"
                tabs={[
                  { value: 'donations', label: 'Confirmed donations', count: donations.length || undefined },
                  { value: 'movements', label: 'Stock movements' },
                ]}
                value={tab}
                onChange={setTab}
              />

              {tab === 'donations' && (
                <>
                  <section className="hospital-inventory-summary" aria-label="Donations summary">
                    <Card>
                      <span>Confirmed donations</span>
                      <strong>{totals.count}</strong>
                      <small>Recorded at this facility</small>
                    </Card>
                    <Card>
                      <span>Units collected</span>
                      <strong>{totals.totalUnits}</strong>
                      <small>Across confirmed donations</small>
                    </Card>
                    <Card>
                      <span>Latest donation</span>
                      <strong className="hospital-inventory-last">
                        {formatDate(totals.latest)}
                      </strong>
                      <small>Most recent collection</small>
                    </Card>
                  </section>

                  <Card className="hospital-inventory-table hospital-inventory-history">
                    <header>
                      <h2>Confirmed donations</h2>
                      <p className="muted">
                        Every confirmed donation record at this facility (schema §2.9).
                      </p>
                    </header>

                    {donationsLoading && <p className="hospital-state">Loading donations…</p>}

                    {!donationsLoading && donationsFailed && (
                      <div role="alert">
                        <p className="hospital-state" data-kind="error">
                          Confirmed donations could not be loaded.
                        </p>
                        <Btn onClick={() => setReloadKey((k) => k + 1)}>Try again</Btn>
                      </div>
                    )}

                    {!donationsLoading && !donationsFailed && donationRows.length === 0 && (
                      <p className="hospital-note">
                        {donations.length === 0 ? (
                          <>
                            No donations confirmed here yet. Screen and confirm matches on the{' '}
                            <Link to={isAdmin ? '/admin/inventory' : '/hospital/inventory'}>
                              Inventory screen
                            </Link>{' '}
                            to record them here.
                          </>
                        ) : (
                          'No donations match this filter.'
                        )}
                      </p>
                    )}

                    {!donationsLoading && !donationsFailed && donationRows.length > 0 && (
                      <>
                        <div className="hospital-table-tools">
                          <label className="hospital-table-tool">
                            <span className="care-sr-only">Filter donations by blood type</span>
                            <select
                              aria-label="Filter donations by blood type"
                              value={donFilterType}
                              onChange={(event) => {
                                setDonFilterType(event.target.value)
                                setDonPage(1)
                              }}
                            >
                              <option value="">All blood types</option>
                              {BLOOD_TYPES.map((bt) => (
                                <option key={bt} value={bt}>
                                  {bt}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="hospital-table-tool">
                            <span className="care-sr-only">Sort donations by date</span>
                            <select
                              aria-label="Sort donations by date"
                              value={donSort}
                              onChange={(event) => {
                                setDonSort(event.target.value)
                                setDonPage(1)
                              }}
                            >
                              <option value="new">Newest first</option>
                              <option value="old">Oldest first</option>
                            </select>
                          </label>
                        </div>

                        <Table
                          className="hospital-table"
                          columns={[
                            {
                              key: 'donationDate',
                              header: 'Date',
                              render: (row) => formatDate(row.donationDate),
                            },
                            {
                              key: 'donorName',
                              header: 'Donor',
                              render: (row) =>
                                row.donorName ? (
                                  row.donorName
                                ) : row.donorId ? (
                                  <code title={row.donorId}>{shortId(row.donorId)}</code>
                                ) : (
                                  '—'
                                ),
                            },
                            {
                              key: 'bloodType',
                              header: 'Blood type',
                              render: (row) =>
                                row.bloodType ? (
                                  <Badge data-blood-type={row.bloodType}>{row.bloodType}</Badge>
                                ) : (
                                  '—'
                                ),
                            },
                            {
                              key: 'units',
                              header: 'Units',
                              render: (row) => <strong>{row.units}</strong>,
                            },
                            {
                              key: 'requestId',
                              header: 'Request',
                              render: (row) =>
                                row.requestId ? <code>{row.requestId}</code> : '—',
                            },
                            {
                              key: 'confirmedBy',
                              header: 'Confirmed by',
                              render: (row) =>
                                row.confirmedBy ? (
                                  <code title={row.confirmedBy}>{shortId(row.confirmedBy)}</code>
                                ) : (
                                  '—'
                                ),
                            },
                          ]}
                          rows={donationPaged}
                          rowKey={(row) => row.id}
                          scroll={false}
                        />

                        <TablePager
                          page={donationCurrentPage}
                          pageCount={donationPageCount}
                          onPage={setDonPage}
                          rangeStart={(donationCurrentPage - 1) * PAGE_SIZE + 1}
                          rangeEnd={Math.min(donationCurrentPage * PAGE_SIZE, donationRows.length)}
                          total={donationRows.length}
                        />

                        <div className="hospital-form-actions">
                          {cursor ? (
                            <Btn onClick={loadMoreDonations} disabled={loadingMore}>
                              {loadingMore ? 'Loading…' : 'Load more'}
                            </Btn>
                          ) : (
                            <span className="muted">End of confirmed donations</span>
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                </>
              )}

              {tab === 'movements' && (
                <Card className="hospital-inventory-table">
                  <header>
                    <h2>Stock movement audit log</h2>
                    <p className="muted">
                      Every change to inventory: donations, transfusions, adjustments, and expired stock (schema §2.3.3).
                    </p>
                  </header>

                  {movementsLoading && <p className="hospital-state">Loading movements…</p>}

                  {!movementsLoading && movementsFailed && (
                    <div role="alert">
                      <p className="hospital-state" data-kind="error">
                        Movement logs could not be loaded.
                      </p>
                      <Btn onClick={() => setReloadKey((k) => k + 1)}>Try again</Btn>
                    </div>
                  )}

                  {!movementsLoading && !movementsFailed && movements.length === 0 && (
                    <p className="hospital-note">
                      No stock movements recorded {selectedType ? `for ${selectedType}` : ''} yet.
                    </p>
                  )}

                  {!movementsLoading && !movementsFailed && movements.length > 0 && (
                    <>
                      <div className="hospital-table-tools">
                        <label className="hospital-table-tool">
                          <span className="care-sr-only">Filter movements by blood type</span>
                          <Select
                            options={TYPE_FILTER_OPTIONS}
                            value={selectedType}
                            onChange={(e) => {
                              setSelectedType(e.target.value)
                              setMovPage(1)
                            }}
                            aria-label="Filter movements by blood type"
                          />
                        </label>
                        <label className="hospital-table-tool">
                          <span className="care-sr-only">Sort movements by date</span>
                          <select
                            aria-label="Sort movements by date"
                            value={movSort}
                            onChange={(event) => {
                              setMovSort(event.target.value)
                              setMovPage(1)
                            }}
                          >
                            <option value="new">Newest first</option>
                            <option value="old">Oldest first</option>
                          </select>
                        </label>
                      </div>

                      <Table
                        className="hospital-table"
                        columns={[
                        {
                          key: 'createdAt',
                          header: 'Date',
                          render: (row) => formatDate(row.createdAt),
                        },
                        {
                          key: 'bloodType',
                          header: 'Blood type',
                          render: (row) => (
                            <Badge data-blood-type={row.bloodType}>{row.bloodType}</Badge>
                          ),
                        },
                        {
                          key: 'changeType',
                          header: 'Type',
                          render: (row) => (
                            <Badge
                              data-status={
                                row.changeType === 'DONATION'
                                  ? 'ok'
                                  : row.changeType === 'EXPIRED'
                                    ? 'rejected'
                                    : 'pending'
                              }
                            >
                              {row.changeType}
                            </Badge>
                          ),
                        },
                        {
                          key: 'unitsChanged',
                          header: 'Change',
                          render: (row) => (
                            <strong
                              style={{
                                color:
                                  row.unitsChanged > 0
                                    ? 'var(--color-ok)'
                                    : 'var(--color-text)',
                              }}
                            >
                              {row.unitsChanged > 0 ? `+${row.unitsChanged}` : row.unitsChanged}
                            </strong>
                          ),
                        },
                        {
                          key: 'reason',
                          header: 'Reason',
                          render: (row) => row.reason || '—',
                        },
                        {
                          key: 'userId',
                          header: 'Actor',
                          render: (row) =>
                            row.userId ? (
                              <code title={row.userId}>{shortId(row.userId)}</code>
                            ) : (
                              '—'
                            ),
                        },
                      ]}
                      rows={movementPaged}
                      rowKey={(row) => `${row.bloodType}_${row.id}`}
                      scroll={false}
                    />

                      <TablePager
                        page={movementCurrentPage}
                        pageCount={movementPageCount}
                        onPage={setMovPage}
                        rangeStart={(movementCurrentPage - 1) * PAGE_SIZE + 1}
                        rangeEnd={Math.min(movementCurrentPage * PAGE_SIZE, movementRows.length)}
                        total={movementRows.length}
                      />
                    </>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
