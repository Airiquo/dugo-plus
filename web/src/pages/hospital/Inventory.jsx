import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  getFacilityMatches,
  getHospitalDonations,
  listHospitals,
  readHospital,
  watchInventory,
} from '../../services/hospitals'
import {
  ADJUSTMENT_TYPES,
  confirmDonation,
  adjustInventory,
  recordTransfusion,
} from '../../services/inventory'
import { BLOOD_TYPES } from '../../services/users'
import { toDate } from '../../utils/eligibility'
import { AppShell } from '../../layout/AppShell'
import { HospitalShell } from '../../layout/HospitalShell'
import {
  Badge,
  Btn,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Tabs,
  Textarea,
} from '../../components'

const BLOOD_TYPE_OPTIONS = BLOOD_TYPES.map((value) => ({ value, label: value }))

const ADJUST_OPTIONS = ADJUSTMENT_TYPES.map((value) => ({
  value,
  label: value === 'EXPIRED' ? 'Expired stock' : 'Manual adjustment',
}))

const HISTORY_PAGE = 50

/** A readable timestamp, or an em dash when the row has never moved. */
function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

/** The empty form for each dialog, and its title. */
const FORMS = {
  transfusion: { kind: 'transfusion', bloodType: '', units: '', requestId: '' },
  adjust: { kind: 'adjust', bloodType: '', delta: '', changeType: 'ADJUSTMENT', reason: '' },
}

const TITLES = {
  transfusion: 'Record transfusion',
  adjust: 'Adjust stock',
}

/** A match can be confirmed only when screening and guidelines are complete. */
function isConfirmable(row) {
  return row.screeningStatus === 'Cleared' && row.guidelinesAcknowledged && Boolean(row.bloodType)
}

/** The log's status tone for a match that has no donation record yet. */
function pendingStatus(row) {
  if (row.screeningStatus === 'Rejected') return { label: 'Rejected', tone: 'rejected' }
  if (row.screeningStatus === 'Deferred') return { label: 'Deferred', tone: 'deferred' }
  if (row.screeningStatus !== 'Cleared') return { label: 'Not screened', tone: 'pending' }
  if (!row.guidelinesAcknowledged) return { label: 'Guidelines pending', tone: 'pending' }
  return { label: 'Ready', tone: 'ok' }
}

/** A donor ID shortened for the table, with the full value in the tooltip. */
function shortId(value) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

/**
 * Blood inventory — `/hospital/inventory` for staff (FR-020, FR-034) and
 * `/admin/inventory` for an admin, who picks the facility first.
 *
 * Reads: live stock per blood type and the facility's donation history, both
 * from `services/hospitals.js`. Writes: three client transactions from
 * `services/inventory.js` — a confirmed match, an issued transfusion, or a
 * reasoned adjustment — each moving the count and its log in one transaction.
 * Staff address their own facility through the claim; an admin sends the
 * picked `hospitalId`, which the server accepts for its claim only.
 */
export default function Inventory() {
  const { profile, role } = useAuth()
  const isAdmin = role === 'admin'
  const staffHospitalId = profile?.hospitalId ?? ''

  const [facilities, setFacilities] = useState([])
  const [facilitiesLoading, setFacilitiesLoading] = useState(false)
  const [facilitiesFailed, setFacilitiesFailed] = useState(false)
  const [picked, setPicked] = useState('')

  const hospitalId = isAdmin ? picked : staffHospitalId

  const [hospital, setHospital] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const [tab, setTab] = useState('stock')

  const [history, setHistory] = useState([])
  const [cursor, setCursor] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)

  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matchesFailed, setMatchesFailed] = useState(false)
  const [selected, setSelected] = useState([])
  const [unitsById, setUnitsById] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [logError, setLogError] = useState('')

  const [note, setNote] = useState('')
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [historyKey, setHistoryKey] = useState(0)

  const bumpHistory = () => setHistoryKey((key) => key + 1)

  // Facility name for the sidebar, once.
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

  // Admin only: the picker's facility list, first entry preselected. Reloads
  // with the page's "Try again" so a failed list can be retried.
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

  // Live stock: one subscription per facility, dropped on change or unmount.
  useEffect(() => {
    if (!hospitalId) {
      setLoading(false)
      setRows([])
      return undefined
    }
    let current = true
    setLoading(true)
    setLoadFailed(false)
    let unsubscribe
    try {
      unsubscribe = watchInventory(
        hospitalId,
        (next) => {
          if (!current) return
          setRows(next)
          setLoading(false)
        },
        () => {
          if (!current) return
          setLoadFailed(true)
          setLoading(false)
        },
      )
    } catch {
      setLoadFailed(true)
      setLoading(false)
    }
    return () => {
      current = false
      if (unsubscribe) unsubscribe()
    }
  }, [hospitalId, reloadKey])

  // Donation log: pending matches and confirmed donations load together so a
  // confirmed match drops out of the pending table in the same paint.
  useEffect(() => {
    if (!hospitalId) return undefined
    let current = true
    setHistoryLoading(true)
    setHistoryFailed(false)
    setMatchesLoading(true)
    setMatchesFailed(false)
    setHistory([])
    setMatches([])
    setCursor(null)
    setSelected([])
    setUnitsById({})
    setLogError('')

    Promise.allSettled([
      getFacilityMatches(hospitalId, { limit: HISTORY_PAGE }),
      getHospitalDonations(hospitalId, { limit: HISTORY_PAGE }),
    ]).then(([matchResult, donationResult]) => {
      if (!current) return
      if (matchResult.status === 'fulfilled') setMatches(matchResult.value)
      else setMatchesFailed(true)

      if (donationResult.status === 'fulfilled') {
        setHistory(donationResult.value.rows)
        setCursor(donationResult.value.cursor)
      } else {
        setHistoryFailed(true)
      }
    }).finally(() => {
      if (!current) return
      setHistoryLoading(false)
      setMatchesLoading(false)
    })

    return () => {
      current = false
    }
  }, [hospitalId, historyKey])

  const totals = useMemo(() => {
    const units = rows.reduce((sum, row) => sum + row.unitsAvailable, 0)
    const stocked = rows.filter((row) => row.unitsAvailable > 0).length
    const latest = rows.reduce((last, row) => {
      const date = toDate(row.lastUpdated)
      return date && (!last || date > last) ? date : last
    }, null)
    return { units, stocked, latest }
  }, [rows])

  const selectedStock = form?.bloodType
    ? rows.find((row) => row.bloodType === form.bloodType)
    : null
  const currentUnits = selectedStock?.unitsAvailable ?? 0

  // The preview only knows the stock of the type chosen in the dialog; the
  // match dialog shows none because the server derives its blood type.
  const projected = useMemo(() => {
    if (!form) return null
    if (form.kind === 'transfusion') {
      const units = Number(form.units)
      if (!Number.isInteger(units) || units < 1) return null
      return currentUnits - units
    }
    if (form.kind === 'adjust') {
      const delta = Number(form.delta)
      if (!Number.isInteger(delta) || delta === 0) return null
      return currentUnits + delta
    }
    return null
  }, [form, currentUnits])

  // Pending rows are matches with no donation record yet; a match's ID is the
  // donation's ID (schema §2.9), so the confirmed set is a direct lookup.
  const donationIds = useMemo(() => new Set(history.map((row) => row.id)), [history])
  const pending = useMemo(
    () => matches.filter((row) => !donationIds.has(row.id)),
    [matches, donationIds],
  )
  const ready = useMemo(() => pending.filter(isConfirmable), [pending])
  const selectedReady = selected.filter((id) => ready.some((row) => row.id === id))
  const allSelected = ready.length > 0 && selectedReady.length === ready.length

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
    setLogError('')
  }

  const toggleAll = () => {
    setSelected((prev) =>
      ready.every((row) => prev.includes(row.id)) ? [] : ready.map((row) => row.id),
    )
    setLogError('')
  }

  const unitsFor = (id) => unitsById[id] ?? '1'

  const updateUnits = (id, value) => {
    setUnitsById((prev) => ({ ...prev, [id]: value }))
    setLogError('')
  }

  const open = (kind, bloodType) => {
    const base = FORMS[kind]
    setForm(bloodType ? { ...base, bloodType } : base)
    setFormError('')
    setNote('')
  }

  const closeForm = () => {
    if (!saving) setForm(null)
  }

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFormError('')
  }

  const loadMore = async () => {
    if (!hospitalId || !cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await getHospitalDonations(hospitalId, { cursor, limit: HISTORY_PAGE })
      setHistory((prev) => [...prev, ...page.rows])
      setCursor(page.cursor)
    } catch {
      setHistoryFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }

  // Confirm every selected match in turn. Sequential transactions avoid
  // retries when several donations land on the same blood type's stock row.
  const confirmSelected = async () => {
    if (!hospitalId || confirming) return
    const chosen = pending.filter((row) => selected.includes(row.id) && isConfirmable(row))
    if (!chosen.length) {
      setLogError('Select at least one cleared donation to confirm.')
      return
    }

    setConfirming(true)
    setLogError('')
    let confirmed = 0
    const failures = []

    for (const row of chosen) {
      const units = Number(unitsFor(row.id))
      if (!Number.isInteger(units) || units < 1) {
        failures.push(`${shortId(row.donorId)}: units must be a whole number above zero`)
        continue
      }
      try {
        await confirmDonation({ matchId: row.id, units })
        confirmed += 1
      } catch (error) {
        failures.push(`${shortId(row.donorId)}: ${error.message}`)
      }
    }

    setConfirming(false)
    setSelected([])
    if (confirmed) {
      setNote(
        `Confirmed ${confirmed} donation${confirmed === 1 ? '' : 's'}. Stock and the inventory log updated in the same transaction${confirmed === 1 ? '' : 's'}.`,
      )
      bumpHistory()
    }
    if (failures.length) {
      setLogError(
        `${failures.length} donation${failures.length === 1 ? '' : 's'} could not be confirmed — ${failures.join('; ')}`,
      )
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form || !hospitalId || saving) return

    setSaving(true)
    setFormError('')
    try {
      if (form.kind === 'transfusion') {
        const units = Number(form.units)
        if (!Number.isInteger(units) || units < 1) {
          throw new Error('Enter a whole number of units greater than zero.')
        }
        const result = await recordTransfusion({
          bloodType: form.bloodType,
          units,
          requestId: form.requestId,
          hospitalId,
        })
        setNote(
          `Issued ${units} unit${units === 1 ? '' : 's'} of ${result.bloodType}. ${result.bloodType} now has ${result.unitsAvailable} unit${result.unitsAvailable === 1 ? '' : 's'}.`,
        )
      } else {
        const delta = Number(form.delta)
        if (!Number.isInteger(delta) || delta === 0) {
          throw new Error('Enter a whole number of units to add or remove.')
        }
        const result = await adjustInventory({
          bloodType: form.bloodType,
          delta,
          reason: form.reason,
          changeType: form.changeType,
          hospitalId,
        })
        setNote(
          `${form.changeType === 'EXPIRED' ? 'Removed' : 'Adjusted'} ${Math.abs(delta)} unit${Math.abs(delta) === 1 ? '' : 's'} of ${result.bloodType}. ${result.bloodType} now has ${result.unitsAvailable} unit${result.unitsAvailable === 1 ? '' : 's'}.`,
        )
      }
      setForm(null)
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'The stock change could not be saved. Check your connection and try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || loading
  const Shell = isAdmin ? AppShell : HospitalShell

  return (
    <Shell facility={hospital?.name}>
      <PageHeader
        tag={isAdmin ? 'Dugo+ admin' : 'Dugo+ hospital'}
        title="Blood inventory"
        actions={
          <Btn
            variant="primary"
            icon="droplet"
            onClick={() => open('transfusion')}
            disabled={busy || !hospitalId}
          >
            Record transfusion
          </Btn>
        }
      />
      <div id="page-body">
        <div className="hospital-inventory">
          {isAdmin && (
            <Card>
              <Field label="Facility">
                <Select
                  options={facilities.map((item) => ({ value: item.id, label: item.name }))}
                  value={picked}
                  onChange={(event) => {
                    setPicked(event.target.value)
                    setNote('')
                  }}
                  disabled={facilitiesLoading || facilitiesFailed || saving}
                  aria-label="Facility"
                />
              </Field>
              {facilitiesLoading && <p className="hospital-state">Loading facilities…</p>}
              {!facilitiesLoading && facilitiesFailed && (
                <div role="alert">
                  <p className="hospital-state" data-kind="error">
                    The facility list could not be loaded.
                  </p>
                  <Btn onClick={() => setReloadKey((key) => key + 1)}>Try again</Btn>
                </div>
              )}
              {!facilitiesLoading && !facilitiesFailed && facilities.length === 0 && (
                <p className="hospital-state" data-kind="warn" role="status">
                  No facilities are registered yet, so there is no inventory to show.
                </p>
              )}
            </Card>
          )}

          {loading && (
            <Card>
              <p className="hospital-state">Loading blood inventory…</p>
            </Card>
          )}

          {!loading && !hospitalId && !isAdmin && (
            <Card>
              <p className="hospital-state" data-kind="warn" role="status">
                This account is not linked to a facility yet. Ask an administrator to set your
                hospital, then reload.
              </p>
            </Card>
          )}

          {!loading && hospitalId && loadFailed && (
            <Card>
              <p className="hospital-state" data-kind="error" role="alert">
                Blood inventory could not be loaded. Check your connection and try again.
              </p>
              <Btn onClick={() => setReloadKey((key) => key + 1)}>Try again</Btn>
            </Card>
          )}

          {!loading && hospitalId && !loadFailed && (
            <>
              <Tabs
                className="hospital-inventory-tabs"
                label="Inventory views"
                tabs={[
                  { value: 'stock', label: 'Stock' },
                  {
                    value: 'log',
                    label: 'Donation log',
                    count: pending.length || undefined,
                  },
                ]}
                value={tab}
                onChange={setTab}
              />

              {note && (
                <p className="hospital-state" data-kind="ok" role="status">
                  {note}
                </p>
              )}

              {tab === 'stock' && (
                <>
                  <section className="hospital-inventory-summary" aria-label="Inventory summary">
                    <Card>
                      <span>Units on hand</span>
                      <strong>{totals.units}</strong>
                      <small>Across all blood types</small>
                    </Card>
                    <Card>
                      <span>Types stocked</span>
                      <strong>
                        {totals.stocked}
                        <small> / {BLOOD_TYPES.length}</small>
                      </strong>
                      <small>With at least one unit</small>
                    </Card>
                    <Card>
                      <span>Last change</span>
                      <strong className="hospital-inventory-last">
                        {formatDate(totals.latest)}
                      </strong>
                      <small>Most recent stock movement</small>
                    </Card>
                  </section>

                  <Card className="hospital-inventory-table">
                    <header>
                      <h2>Stock by blood type</h2>
                      <p className="muted">
                        Counts follow the facility's stock live. Every movement writes in one
                        transaction with its inventory log.
                      </p>
                    </header>
                    <Table
                      columns={[
                        {
                          key: 'bloodType',
                          header: 'Blood type',
                          render: (row) => (
                            <Badge data-blood-type={row.bloodType}>{row.bloodType}</Badge>
                          ),
                        },
                        {
                          key: 'unitsAvailable',
                          header: 'Units on hand',
                          render: (row) => (
                            <strong className="hospital-inventory-units">
                              {row.unitsAvailable}
                            </strong>
                          ),
                        },
                        {
                          key: 'lastUpdated',
                          header: 'Last updated',
                          render: (row) => formatDate(row.lastUpdated),
                        },
                        {
                          key: 'actions',
                          header: 'Actions',
                          render: (row) => (
                            <div className="hospital-inventory-actions">
                              <Btn
                                icon="droplet"
                                onClick={() => open('transfusion', row.bloodType)}
                                disabled={row.unitsAvailable === 0}
                              >
                                Issue
                              </Btn>
                              <Btn icon="settings" onClick={() => open('adjust', row.bloodType)}>
                                Adjust
                              </Btn>
                            </div>
                          ),
                        },
                      ]}
                      rows={rows}
                      rowKey={(row) => row.bloodType}
                      rowProps={(row) => ({
                        'data-empty': row.unitsAvailable === 0 ? 'true' : undefined,
                      })}
                    />
                  </Card>
                </>
              )}

              {tab === 'log' && (
                <>
                  <Card className="hospital-inventory-table hospital-inventory-log">
                    <header>
                      <h2>Awaiting confirmation</h2>
                      <p className="muted">
                        Cleared matches at this facility without a donation record. Select one or
                        more, set the units collected, and confirm.
                      </p>
                    </header>

                    {matchesLoading && <p className="hospital-state">Loading donation log…</p>}

                    {!matchesLoading && historyFailed && (
                      <div role="alert">
                        <p className="hospital-state" data-kind="error">
                          Confirmed donations could not be loaded, so the pending list is
                          unavailable.
                        </p>
                        <Btn onClick={bumpHistory}>Try again</Btn>
                      </div>
                    )}

                    {!matchesLoading && !historyFailed && matchesFailed && (
                      <div role="alert">
                        <p className="hospital-state" data-kind="error">
                          The donation log could not be loaded.
                        </p>
                        <Btn onClick={bumpHistory}>Try again</Btn>
                      </div>
                    )}

                    {!matchesLoading && !historyFailed && !matchesFailed && pending.length === 0 && (
                      <p className="hospital-note">
                        No donations are waiting to be confirmed. Cleared matches appear here as
                        the matcher records them.
                      </p>
                    )}

                    {!matchesLoading && !historyFailed && !matchesFailed && pending.length > 0 && (
                      <>
                        <div className="hospital-inventory-bulk">
                          <span className="muted">
                            {selectedReady.length
                              ? `${selectedReady.length} selected`
                              : `${ready.length} ready to confirm`}
                          </span>
                          <Btn
                            variant="primary"
                            onClick={confirmSelected}
                            disabled={!selectedReady.length || confirming}
                          >
                            {confirming
                              ? 'Confirming…'
                              : `Confirm selected${selectedReady.length ? ` (${selectedReady.length})` : ''}`}
                          </Btn>
                        </div>

                        {logError && (
                          <p className="hospital-state" data-kind="error" role="alert">
                            {logError}
                          </p>
                        )}

                        <Table
                          columns={[
                            {
                              key: 'select',
                              header: (
                                <input
                                  type="checkbox"
                                  className="hospital-inventory-check"
                                  aria-label="Select every ready donation"
                                  checked={allSelected}
                                  disabled={!ready.length || confirming}
                                  onChange={toggleAll}
                                />
                              ),
                              cellProps: { className: 'hospital-inventory-check-cell' },
                              render: (row) => {
                                const confirmable = isConfirmable(row)
                                return (
                                  <input
                                    type="checkbox"
                                    className="hospital-inventory-check"
                                    aria-label={`Select donation by ${row.donorId || row.id}`}
                                    checked={selected.includes(row.id)}
                                    disabled={!confirmable || confirming}
                                    onChange={() => toggle(row.id)}
                                  />
                                )
                              },
                            },
                            {
                              key: 'matchedAt',
                              header: 'Matched',
                              render: (row) => formatDate(row.matchedAt),
                            },
                            {
                              key: 'donorId',
                              header: 'Donor',
                              render: (row) =>
                                row.donorId ? (
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
                              render: (row) =>
                                isConfirmable(row) ? (
                                  <Input
                                    className="hospital-inventory-unit-input"
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    step="1"
                                    value={unitsFor(row.id)}
                                    onChange={(event) => updateUnits(row.id, event.target.value)}
                                    disabled={confirming}
                                    aria-label={`Units collected from ${row.donorId || row.id}`}
                                  />
                                ) : (
                                  '—'
                                ),
                            },
                            {
                              key: 'requestId',
                              header: 'Request',
                              render: (row) =>
                                row.requestId ? <code>{row.requestId}</code> : '—',
                            },
                            {
                              key: 'status',
                              header: 'Status',
                              render: (row) => {
                                const status = pendingStatus(row)
                                return <Badge data-status={status.tone}>{status.label}</Badge>
                              },
                            },
                          ]}
                          rows={pending}
                          rowKey={(row) => row.id}
                        />
                      </>
                    )}
                  </Card>

                  <Card className="hospital-inventory-table hospital-inventory-history">
                    <header>
                      <h2>Confirmed donations</h2>
                      <p className="muted">
                        Every confirmed donation at this facility, newest first (schema §2.9).
                      </p>
                    </header>

                    {historyLoading && <p className="hospital-state">Loading donations…</p>}

                    {!historyLoading && historyFailed && (
                      <div role="alert">
                        <p className="hospital-state" data-kind="error">
                          Confirmed donations could not be loaded.
                        </p>
                        <Btn onClick={bumpHistory}>Try again</Btn>
                      </div>
                    )}

                    {!historyLoading && !historyFailed && history.length === 0 && (
                      <p className="hospital-note">
                        No donations confirmed here yet. Confirm a match above and it lands on this
                        list.
                      </p>
                    )}

                    {!historyLoading && !historyFailed && history.length > 0 && (
                      <>
                        <Table
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
                              render: (row) => row.units,
                            },
                            {
                              key: 'requestId',
                              header: 'Request',
                              render: (row) =>
                                row.requestId ? <code>{row.requestId}</code> : '—',
                            },
                          ]}
                          rows={history}
                          rowKey={(row) => row.id}
                        />
                        <div className="hospital-form-actions">
                          {cursor ? (
                            <Btn onClick={loadMore} disabled={loadingMore}>
                              {loadingMore ? 'Loading…' : 'Load more'}
                            </Btn>
                          ) : (
                            <span className="muted">End of the log</span>
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        name="hospital-inventory"
        open={Boolean(form)}
        onClose={closeForm}
        title={form ? TITLES[form.kind] : ''}
      >
        {form && (
          <form
            className="hospital-inventory-form"
            noValidate
            onSubmit={submit}
            aria-busy={saving || undefined}
          >
            {form.kind === 'transfusion' && (
              <>
                <p className="hospital-note">
                  Issue stock against this facility's counts. Link a request to mark it fulfilled
                  in the same transaction.
                </p>
                <div className="hospital-inventory-form-grid">
                  <Field label="Blood type">
                    <Select
                      options={BLOOD_TYPE_OPTIONS}
                      value={form.bloodType}
                      onChange={(event) => update('bloodType', event.target.value)}
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Units">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={form.units}
                      onChange={(event) => update('units', event.target.value)}
                      disabled={saving}
                      autoFocus
                    />
                  </Field>
                  <Field label="Request ID (optional)">
                    <Input
                      type="text"
                      value={form.requestId}
                      onChange={(event) => update('requestId', event.target.value)}
                      disabled={saving}
                    />
                  </Field>
                </div>
              </>
            )}

            {form.kind === 'adjust' && (
              <>
                <p className="hospital-note">
                  Corrections and expired units keep a written reason in the inventory log. The
                  count may not go below zero.
                </p>
                <div className="hospital-inventory-form-grid">
                  <Field label="Blood type">
                    <Select
                      options={BLOOD_TYPE_OPTIONS}
                      value={form.bloodType}
                      onChange={(event) => update('bloodType', event.target.value)}
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Change in units">
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      placeholder="-1"
                      value={form.delta}
                      onChange={(event) => update('delta', event.target.value)}
                      disabled={saving}
                      autoFocus
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      options={ADJUST_OPTIONS}
                      value={form.changeType}
                      onChange={(event) => update('changeType', event.target.value)}
                      disabled={saving}
                    />
                  </Field>
                </div>
                <Field label="Reason">
                  <Textarea
                    rows={2}
                    value={form.reason}
                    onChange={(event) => update('reason', event.target.value)}
                    disabled={saving}
                  />
                </Field>
              </>
            )}

            {(form.kind === 'transfusion' || form.kind === 'adjust') && rows.length > 0 && (
              <dl className="hospital-inventory-preview">
                <div>
                  <dt>Current</dt>
                  <dd>
                    {currentUnits} unit{currentUnits === 1 ? '' : 's'}
                  </dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd data-over={projected != null && projected < 0 ? 'true' : undefined}>
                    {projected == null ? '—' : `${projected} unit${projected === 1 ? '' : 's'}`}
                  </dd>
                </div>
              </dl>
            )}

            {formError && (
              <p className="hospital-state" data-kind="error" role="alert">
                {formError}
              </p>
            )}

            <div className="hospital-dialog-actions">
              <Btn onClick={closeForm} disabled={saving}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" disabled={saving}>
                {saving
                  ? 'Saving…'
                  : form.kind === 'confirm'
                    ? 'Confirm donation'
                    : form.kind === 'transfusion'
                      ? 'Record transfusion'
                      : 'Apply adjustment'}
              </Btn>
            </div>
          </form>
        )}
      </Modal>
    </Shell>
  )
}
