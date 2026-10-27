/**
 * Hospital blood requests — `/hospital/requests` (FR-016, FR-037 list half).
 *
 * Lists the facility's requests, urgency first (the shared `sortRequestsByUrgency`
 * the matcher queue uses), with status filters and the empty/loading/error
 * states. Posting is `NewRequest`; moving a request's status on needs the staff
 * custom claim, which is not issued yet, so this screen is read-only.
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
} from '../../services/requests'
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

export default function Requests() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''

  const [hospital, setHospital] = useState(null)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

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
          <Table columns={COLUMNS} rows={ordered} rowKey={(row) => row.id} />
        )}
      </section>
    </HospitalShell>
  )
}
