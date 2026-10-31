import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getHospitalDonations, listHospitals, readHospital, watchInventory } from '../../services/hospitals'
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
  confirm: { kind: 'confirm', matchId: '', units: '', points: '10' },
  transfusion: { kind: 'transfusion', bloodType: '', units: '', requestId: '' },
  adjust: { kind: 'adjust', bloodType: '', delta: '', changeType: 'ADJUSTMENT', reason: '' },
}

const TITLES = {
  confirm: 'Confirm donation',
  transfusion: 'Record transfusion',
  adjust: 'Adjust stock',
}

/**
 * Blood inventory — `/hospital/inventory` for staff (FR-020, FR-034) and
 * `/admin/inventory` for an admin, who picks the facility first.
 *
 * Reads: live stock per blood type and the facility's donation history, both
 * from `services/hospitals.js`. Writes: three server callables from
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

  const [history, setHistory] = useState([])
  const [cursor, setCursor] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)

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

  // Donation history: first page on mount, again after every confirmation.
  useEffect(() => {
    if (!hospitalId) return undefined
    let current = true
    setHistoryLoading(true)
    setHistoryFailed(false)
    setHistory([])
    setCursor(null)
    getHospitalDonations(hospitalId, { limit: HISTORY_PAGE })
      .then((page) => {
        if (!current) return
        setHistory(page.rows)
        setCursor(page.cursor)
      })
      .catch(() => current && setHistoryFailed(true))
      .finally(() => current && setHistoryLoading(false))
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

  const selected = form?.bloodType ? rows.find((row) => row.bloodType === form.bloodType) : null
  const currentUnits = selected?.unitsAvailable ?? 0

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

  const submit = async (event) => {
    event.preventDefault()
    if (!form || !hospitalId || saving) return

    setSaving(true)
    setFormError('')
    try {
      if (form.kind === 'confirm') {
        const units = Number(form.units)
        const points = Number(form.points || 10)
        if (!Number.isInteger(units) || units < 1) {
          throw new Error('Enter a whole number of units greater than zero.')
        }
        if (!Number.isInteger(points) || points < 1) {
          throw new Error('Reward points must be a whole number greater than zero.')
        }
        if (!form.matchId.trim()) throw new Error('Enter the match ID to confirm.')
        const result = await confirmDonation({ matchId: form.matchId, units, points })
        setNote(
          `Confirmed ${units} unit${units === 1 ? '' : 's'} of ${result.bloodType} for match ${result.donationId}. ${result.bloodType} now has ${result.unitsAvailable} unit${result.unitsAvailable === 1 ? '' : 's'}.`,
        )
        bumpHistory()
      } else if (form.kind === 'transfusion') {
        const units = Number(form.units)
        if (!Number.isInteger(units) || units < 1) {
          throw new Error('Enter a whole number of units greater than zero.')
        }
        const result = await recordTransfusion({
          bloodType: form.bloodType,
          units,
          requestId: form.requestId,
          hospitalId: isAdmin ? hospitalId : undefined,
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
          hospitalId: isAdmin ? hospitalId : undefined,
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
          <>
            <Btn
              variant="primary"
              icon="plus"
              onClick={() => open('confirm')}
              disabled={busy || !hospitalId}
            >
              Confirm donation
            </Btn>
            <Btn
              icon="droplet"
              onClick={() => open('transfusion')}
              disabled={busy || !hospitalId}
            >
              Record transfusion
            </Btn>
            <Btn icon="settings" onClick={() => open('adjust')} disabled={busy || !hospitalId}>
              Adjust stock
            </Btn>
          </>
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
                  <strong className="hospital-inventory-last">{formatDate(totals.latest)}</strong>
                  <small>Most recent stock movement</small>
                </Card>
              </section>

              {note && (
                <p className="hospital-state" data-kind="ok" role="status">
                  {note}
                </p>
              )}

              <Card className="hospital-inventory-table">
                <header>
                  <h2>Stock by blood type</h2>
                  <p className="muted">
                    Counts follow the facility's stock live. Every movement is written server-side
                    with its inventory log.
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
                        <strong className="hospital-inventory-units">{row.unitsAvailable}</strong>
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

              <Card className="hospital-inventory-table hospital-inventory-history">
                <header>
                  <h2>Donation history</h2>
                  <p className="muted">
                    Confirmed donations at this facility, newest first (schema §2.9).
                  </p>
                </header>

                {historyLoading && <p className="hospital-state">Loading donations…</p>}

                {!historyLoading && historyFailed && (
                  <div role="alert">
                    <p className="hospital-state" data-kind="error">
                      Donation history could not be loaded.
                    </p>
                    <Btn onClick={bumpHistory}>Try again</Btn>
                  </div>
                )}

                {!historyLoading && !historyFailed && history.length === 0 && (
                  <p className="hospital-note">
                    No donations confirmed here yet. Confirm a cleared match and it lands on this
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
                          render: (row) => row.donorName || row.donorId || '—',
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
                          render: (row) => (row.requestId ? <code>{row.requestId}</code> : '—'),
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
                        <span className="muted">End of history</span>
                      )}
                    </div>
                  </>
                )}
              </Card>
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
            {form.kind === 'confirm' && (
              <>
                <p className="hospital-note">
                  Confirming a cleared match writes the donation, the stock, its log, the donor's
                  donation date and the reward points in one transaction.
                </p>
                <div className="hospital-inventory-form-grid">
                  <Field label="Match ID">
                    <Input
                      type="text"
                      value={form.matchId}
                      onChange={(event) => update('matchId', event.target.value)}
                      disabled={saving}
                      autoFocus
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
                    />
                  </Field>
                  <Field label="Reward points">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={form.points}
                      onChange={(event) => update('points', event.target.value)}
                      disabled={saving}
                    />
                  </Field>
                </div>
              </>
            )}

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
