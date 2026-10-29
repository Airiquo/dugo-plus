/**
 * Hospital blood requests — `/hospital/requests` (FR-016, FR-037 list half).
 *
 * Lists the facility's requests, urgency first (the shared `sortRequestsByUrgency`
 * the matcher queue uses), with status filters and the empty/loading/error
 * states. Posting is `NewRequest`; an active request can be moved on here (the
 * "manage" half of FR-016), which needs the staff custom claim — published by
 * `scripts/set-claims.mjs` (D26/D15), so an account without claims is denied by
 * the rules and the screen says so.
 */

import { useEffect, useMemo, useState } from 'react'
import { Chip, LinkBtn, PageHeader, Table, Tabs } from '../../components'
import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import {
  ACTIVE_STATUSES,
  componentLabel,
  fetchHospital,
  listHospitalRequests,
  updateRequestStatus,
} from '../../services/requests'
import { isMatchingConfigured } from '../../services/matching'
import { sortRequestsByUrgency } from '../../utils/matching'

/** The status filters shown above the table; `active` is the default view. */
const FILTERS = [
  { value: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { value: 'urgent', label: 'Urgent', statuses: ['urgent'] },
  { value: 'collecting', label: 'Collecting', statuses: ['collecting'] },
  { value: 'matched', label: 'Matched', statuses: ['matched'] },
  { value: 'fulfilled', label: 'Fulfilled', statuses: ['fulfilled'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

/** `Aug 3, 14:20` from a Date; an em dash for a missing value. */
function formatWhen(date) {
  if (!date) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const COLUMNS = [
  {
    key: 'bloodType',
    header: 'Type',
    render: (row) => <Chip data-blood-type={row.bloodType}>{row.bloodType}</Chip>,
  },
  { key: 'component', header: 'Component', render: (row) => componentLabel(row.component) },
  { key: 'quantity', header: 'Units', cellProps: { 'data-align': 'right' } },
  {
    key: 'urgencyLevel',
    header: 'Priority',
    render: (row) => <Chip data-priority={row.urgencyLevel}>{row.urgencyLevel}</Chip>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Chip data-status={row.status}>{row.status}</Chip>,
  },
  { key: 'requested', header: 'Requested', render: (row) => formatWhen(row.createdAt) },
]

/** Statuses an active request can be moved to from the list (FR-016). */
const MANAGE_STATUSES = ['collecting', 'matched', 'fulfilled', 'cancelled']

/** Terminal moves ask for a confirmation before writing. */
const NEEDS_CONFIRM = new Set(['fulfilled', 'cancelled'])

export default function Requests() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [hospital, setHospital] = useState(null)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState('')
  const [note, setNote] = useState('')

  const statuses = useMemo(
    () => FILTERS.find((item) => item.value === filter)?.statuses ?? ACTIVE_STATUSES,
    [filter],
  )

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false)
      return
    }
    let current = true
    setLoading(true)
    // The hospital read is needed for the sidebar name; the request read is the
    // screen. Both are keyed to the same account, so a failed one is one error.
    listHospitalRequests(hospitalId, statuses)
      .then((found) => {
        if (!current) return
        setRows(found)
        setError('')
      })
      .catch((err) => {
        if (!current) return
        setError(err?.message || 'Requests could not be loaded. Check your connection.')
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [hospitalId, statuses, reloadKey])

  useEffect(() => {
    if (!hospitalId) return
    let current = true
    fetchHospital(hospitalId)
      .then((found) => {
        if (current) setHospital(found)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [hospitalId])

  const ordered = useMemo(() => sortRequestsByUrgency(rows), [rows])

  /** Move a request on, then reload the list (FR-016). */
  const changeStatus = async (row, status) => {
    if (!status) return
    if (NEEDS_CONFIRM.has(status) && !window.confirm(`Mark this ${row.bloodType} request as ${status}?`)) {
      return
    }
    setBusyId(row.id)
    setNote('')
    try {
      await updateRequestStatus(row.id, status)
      setNote(`Request marked ${status}.`)
      setReloadKey((key) => key + 1)
    } catch (err) {
      const denied = /permission|insufficient/i.test(err?.message || '')
      setNote(
        denied
          ? 'You do not have permission to change this request — it needs the staff claim (ask the team to run the claims script).'
          : 'Could not update the request. Check your connection and try again.',
      )
    } finally {
      setBusyId('')
    }
  }

  const columns = [
    ...COLUMNS,
    {
      key: 'manage',
      header: 'Manage',
      render: (row) =>
        ACTIVE_STATUSES.includes(row.status) ? (
          <select
            aria-label={`Change status of the ${row.bloodType} request`}
            value=""
            disabled={busyId === row.id}
            onChange={(event) => changeStatus(row, event.target.value)}
          >
            <option value="">{busyId === row.id ? 'Saving…' : 'Set status…'}</option>
            {MANAGE_STATUSES.filter((status) => status !== row.status).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ]

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader
        tag="Dugo+ hospital"
        title="Blood requests"
        actions={
          <>
            <button
              className="btn tx"
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <LinkBtn variant="primary" icon="plus" to="/hospital/requests/new">
              New request
            </LinkBtn>
          </>
        }
      />

      <section className="card hospital-requests">
        <Tabs label="Request status" tabs={FILTERS} value={filter} onChange={setFilter} />

        {!isMatchingConfigured() && (
          <p className="hospital-state" data-kind="warn" role="status">
            Immediate matching is offline (the Worker endpoint is not configured). New requests are
            picked up by the scheduled matching run instead.
          </p>
        )}

        {note && (
          <p className="hospital-state" role="status">
            {note}
          </p>
        )}

        {!hospitalId ? (
          <p className="hospital-state" data-kind="warn" role="status">
            This account is not linked to a facility yet. Ask an administrator to set your
            hospital, then reload.
          </p>
        ) : error ? (
          <p className="hospital-state" data-kind="error" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="hospital-state">Loading requests…</p>
        ) : ordered.length === 0 ? (
          <p className="hospital-state">
            No {filter === 'active' ? 'active ' : ''}requests. Post one to start matching donors.
          </p>
        ) : (
          <Table columns={columns} rows={ordered} rowKey={(row) => row.id} />
        )}
      </section>
    </HospitalShell>
  )
}
