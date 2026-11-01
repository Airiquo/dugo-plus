/** Facility request queue, filters and explicit status updates (FR-016, FR-037). */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, LinkBtn, PageHeader, Table, RequestStatusDialog } from '../../components'
import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import {
  ACTIVE_STATUSES,
  COMPONENTS,
  componentLabel,
  fetchHospital,
  listHospitalRequests,
  updateRequestStatus,
} from '../../services/requests'
import { isMatchingConfigured } from '../../services/matching'
import { sortRequestsByUrgency } from '../../utils/matching'

const STATUS_LABELS = {
  urgent: 'Open',
  collecting: 'Collecting',
  matched: 'Matched',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}
const FILTERS = [
  { value: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  ...['urgent', 'collecting', 'matched', 'fulfilled', 'cancelled'].map((value) => ({
    value,
    label: STATUS_LABELS[value],
    statuses: [value],
  })),
]
const MANAGE_STATUSES = ['collecting', 'matched', 'fulfilled', 'cancelled']
const NEEDS_CONFIRM = new Set(['fulfilled', 'cancelled'])
const priorityLabel = (value) =>
  ({ urgent: 'Urgent', stat: 'Stat', routine: 'Routine' })[value] || value || 'Not set'
const shortId = (row) => row.id.slice(-6).toUpperCase()

function requestedDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    return <span className="hreq-muted">Not recorded</span>
  return (
    <time dateTime={date.toISOString()}>
      <span>
        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
      <small>{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small>
    </time>
  )
}

export default function Requests() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId ?? ''
  const currentTabRef = useRef(null)
  const [hospital, setHospital] = useState(null)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [component, setComponent] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedAt, setLoadedAt] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState(null)
  const [rowError, setRowError] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const statuses = useMemo(
    () => FILTERS.find((item) => item.value === filter)?.statuses ?? ACTIVE_STATUSES,
    [filter],
  )

  useEffect(() => {
    if (!hospitalId) {
      setRows([])
      setLoading(false)
      return
    }
    let current = true
    setLoading(true)
    listHospitalRequests(hospitalId, statuses)
      .then((found) => {
        if (!current) return
        setRows(found)
        setLoadedAt(new Date())
        setError('')
      })
      .catch((err) => {
        if (current)
          setError(
            err?.message || 'Requests could not be loaded. Check your connection and try again.',
          )
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
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return ordered.filter(
      (row) =>
        (component === 'all' || row.component === component) &&
        (!query ||
          [
            row.id,
            row.bloodType,
            componentLabel(row.component),
            priorityLabel(row.urgencyLevel),
            STATUS_LABELS[row.status],
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)),
    )
  }, [ordered, search, component])
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const paged = visible.slice(start, start + pageSize)
  const viewReady = hospitalId && !loading && !error
  const metrics = [
    {
      label: 'Requests in this view',
      value: visible.length,
      icon: 'list',
      hint: FILTERS.find((item) => item.value === filter)?.label + ' requests',
    },
    {
      label: 'Units requested',
      value: visible.reduce((sum, row) => sum + row.quantity, 0),
      icon: 'droplet',
      hint: 'Across the current view',
    },
    {
      label: 'Time-sensitive',
      value: visible.filter((row) => ['urgent', 'stat'].includes(row.urgencyLevel)).length,
      icon: 'alert',
      hint: 'Urgent or stat priority',
    },
  ]

  const selectFilter = (value) => {
    if (busyId) return
    setFilter(value)
    setPage(1)
    setDrafts({})
    setRowError(null)
  }
  const resetSearch = () => {
    setSearch('')
    setComponent('all')
    setPage(1)
  }
  const tabKey = (event) => {
    const buttons = [...event.currentTarget.querySelectorAll('[role="tab"]')]
    const index = buttons.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    else return
    event.preventDefault()
    if (!busyId) {
      buttons[next].focus()
      selectFilter(FILTERS[next].value)
    }
  }

  const changeStatus = async (row, status = drafts[row.id]) => {
    if (!status || busyId || !MANAGE_STATUSES.includes(status) || status === row.status) return
    setBusyId(row.id)
    setNotice(null)
    setRowError(null)
    try {
      await updateRequestStatus(row.id, status)
      setConfirmation(null)
      setNotice({ text: `Request #${shortId(row)} marked ${STATUS_LABELS[status].toLowerCase()}.` })
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[row.id]
        return next
      })
      setReloadKey((key) => key + 1)
    } catch (err) {
      setRowError({
        id: row.id,
        text: /permission|insufficient/i.test(err?.message || '')
          ? 'Your account cannot update this request. Contact your administrator.'
          : 'Update failed. Check your connection and apply again.',
      })
    } finally {
      setBusyId('')
    }
  }

  const requestUpdate = (row) => {
    const status = drafts[row.id]
    if (NEEDS_CONFIRM.has(status)) {
      setRowError(null)
      setConfirmation({
        row,
        status,
        label: STATUS_LABELS[status],
        component: componentLabel(row.component),
        shortId: shortId(row),
      })
    } else changeStatus(row, status)
  }

  const columns = [
    {
      key: 'request',
      header: 'Blood & component',
      cellProps: { 'data-label': 'Request' },
      render: (row) => (
        <div className="hreq-identity">
          <span className="hreq-blood">{row.bloodType || '—'}</span>
          <div>
            <strong>{componentLabel(row.component) || 'Not recorded'}</strong>
            <small title={row.id}>Request #{shortId(row)}</small>
          </div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Units',
      cellProps: { 'data-label': 'Units' },
      render: (row) => (
        <span className="hreq-quantity">
          <strong>{row.quantity}</strong>
          <small>{row.quantity === 1 ? 'unit' : 'units'}</small>
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      cellProps: { 'data-label': 'Priority' },
      render: (row) => (
        <span className="hreq-priority" data-priority={row.urgencyLevel}>
          <i aria-hidden="true" />
          {priorityLabel(row.urgencyLevel)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cellProps: { 'data-label': 'Status' },
      render: (row) => (
        <span className="hreq-status" data-status={row.status}>
          {['matched', 'fulfilled'].includes(row.status) && <Icon name="check" size={13} />}
          {STATUS_LABELS[row.status] || row.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Requested',
      cellProps: { 'data-label': 'Requested' },
      render: (row) => requestedDate(row.createdAt),
    },
    {
      key: 'manage',
      header: 'Action',
      cellProps: { 'data-label': 'Action' },
      render: (row) =>
        ACTIVE_STATUSES.includes(row.status) ? (
          <div className="hreq-action">
            <div>
              <select
                aria-label={`New status for request ${shortId(row)}`}
                value={drafts[row.id] || ''}
                disabled={Boolean(busyId)}
                onChange={(event) => {
                  setDrafts((previous) => ({ ...previous, [row.id]: event.target.value }))
                  if (rowError?.id === row.id) setRowError(null)
                }}
              >
                <option value="">Change status</option>
                {MANAGE_STATUSES.filter((status) => status !== row.status).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <button
                className="hreq-apply"
                type="button"
                disabled={Boolean(busyId) || !drafts[row.id]}
                onClick={() => requestUpdate(row)}
                aria-label={`Apply status change to request ${shortId(row)}`}
              >
                {busyId === row.id ? 'Saving…' : 'Apply'}
              </button>
            </div>
            {rowError?.id === row.id && (
              <span className="hreq-row-error" role="alert">
                {rowError.text}
              </span>
            )}
          </div>
        ) : (
          <span className="hreq-closed">
            <Icon name={row.status === 'fulfilled' ? 'check' : 'x'} size={14} />
            Closed
          </span>
        ),
    },
  ]

  return (
    <HospitalShell facility={hospital?.name}>
      <PageHeader
        className="hreq-header"
        tag="Hospital workspace"
        title="Blood requests"
        actions={
          <>
            <button
              className="btn hreq-refresh"
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading || Boolean(busyId)}
            >
              <Icon name="refresh" size={16} />
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            {hospitalId ? (
              <LinkBtn variant="primary" icon="plus" to="/hospital/requests/new">
                New request
              </LinkBtn>
            ) : (
              <button className="btn" data-primary type="button" disabled>
                New request
              </button>
            )}
          </>
        }
      />
      <p className="hreq-description">
        A clear view of what’s needed. Keep every request moving toward care.
      </p>
      <div className="hreq-overview" aria-label="Current request view summary">
        {metrics.map((metric) => (
          <div className="hreq-metric" key={metric.label}>
            <div>
              <span>{metric.label}</span>
              <strong>{viewReady ? metric.value.toLocaleString() : '—'}</strong>
              <small>{metric.hint}</small>
            </div>
            <span className="hreq-metric-icon" aria-hidden="true">
              <Icon name={metric.icon} size={23} />
            </span>
          </div>
        ))}
      </div>
      {!isMatchingConfigured() && (
        <div className="hreq-banner" role="status">
          <Icon name="alert" size={18} />
          <p>
            <strong>Matching update</strong> Immediate matching is unavailable. New requests will be
            picked up by the scheduled matching run.
          </p>
        </div>
      )}
      {notice && (
        <div className="hreq-banner" data-kind="success" role="status">
          <Icon name="check" size={18} />
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss update">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}
      <section className="card hreq-workspace" aria-labelledby="hreq-queue-title">
        <header className="hreq-workspace-heading">
          <div>
            <h2 id="hreq-queue-title">
              Request queue<span>{viewReady ? visible.length : '—'}</span>
            </h2>
            <p>Urgency first, then oldest. Open requests are awaiting donors.</p>
          </div>
          {loadedAt && !loading && !error && (
            <span className="hreq-updated">
              <i aria-hidden="true" />
              Updated{' '}
              {loadedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </header>
        <nav className="hreq-tabs" role="tablist" aria-label="Request status" onKeyDown={tabKey}>
          {FILTERS.map((item) => (
            <button
              className="tab"
              type="button"
              role="tab"
              key={item.value}
              id={`hreq-tab-${item.value}`}
              ref={filter === item.value ? currentTabRef : null}
              aria-selected={filter === item.value}
              aria-controls="hreq-view"
              tabIndex={filter === item.value ? 0 : -1}
              disabled={Boolean(busyId)}
              onClick={() => selectFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div
          id="hreq-view"
          role="tabpanel"
          aria-labelledby={`hreq-tab-${filter}`}
          aria-busy={loading}
        >
          <div className="hreq-toolbar">
            <label className="hreq-search">
              <span className="care-sr-only">Search requests</span>
              <Icon name="search" size={18} />
              <input
                type="search"
                aria-label="Search requests"
                placeholder="Search type, component or ID…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                disabled={loading || !hospitalId}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                >
                  <Icon name="x" size={15} />
                </button>
              )}
            </label>
            <label className="hreq-component">
              <span>Component</span>
              <select
                aria-label="Filter by component"
                value={component}
                onChange={(event) => {
                  setComponent(event.target.value)
                  setPage(1)
                }}
                disabled={loading || !hospitalId}
              >
                <option value="all">All components</option>
                {COMPONENTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.short}
                  </option>
                ))}
              </select>
            </label>
            <span className="hreq-sort">
              <Icon name="list" size={15} />
              Priority order
            </span>
          </div>
          {!hospitalId ? (
            <div className="hreq-empty" role="status">
              <span>
                <Icon name="box" size={29} />
              </span>
              <h3>Connect your facility</h3>
              <p>
                This account is not linked to a hospital. Ask your administrator to link your
                facility, then refresh.
              </p>
            </div>
          ) : error ? (
            <div className="hreq-empty" role="alert">
              <span>
                <Icon name="alert" size={29} />
              </span>
              <h3>We couldn’t load your requests</h3>
              <p>{error}</p>
              <button className="btn" type="button" onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="hreq-loading" role="status">
              <span className="care-sr-only">Loading requests…</span>
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} aria-hidden="true">
                  <i />
                  <b />
                  <i />
                  <i />
                  <b />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="hreq-empty" role="status">
              <span>
                <Icon name={search || component !== 'all' ? 'search' : 'droplet'} size={29} />
              </span>
              <h3>
                {search || component !== 'all'
                  ? 'No requests match your filters'
                  : 'A little quiet here'}
              </h3>
              <p>
                {search || component !== 'all'
                  ? 'Try another blood type or request ID, or clear your filters.'
                  : `There are no ${filter === 'active' ? 'active' : STATUS_LABELS[filter]?.toLowerCase()} requests in this view.`}
              </p>
              {search || component !== 'all' ? (
                <button className="btn" type="button" onClick={resetSearch}>
                  Clear filters
                </button>
              ) : filter === 'active' ? (
                <LinkBtn to="/hospital/requests/new" variant="primary" icon="plus">
                  Create a request
                </LinkBtn>
              ) : (
                <button className="btn" type="button" onClick={() => selectFilter('active')}>
                  View active requests
                </button>
              )}
            </div>
          ) : (
            <div
              className="hreq-table-wrap"
              role="region"
              aria-label="Blood request table; scroll horizontally on smaller screens"
              tabIndex={0}
            >
              <Table
                className="hreq-table"
                aria-label="Facility blood requests"
                columns={columns}
                rows={paged}
                rowKey={(row) => row.id}
                scroll={false}
                rowProps={(row) => ({
                  'data-priority': row.urgencyLevel,
                  'data-saving': busyId === row.id,
                })}
              />
            </div>
          )}
          {viewReady && visible.length > 0 && (
            <footer className="hreq-pagination">
              <p aria-live="polite">
                Showing{' '}
                <strong>
                  {start + 1}–{Math.min(start + pageSize, visible.length)}
                </strong>{' '}
                of <strong>{visible.length}</strong> requests
              </p>
              <label>
                Rows per page
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                >
                  {[10, 25, 50].map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
              </label>
              <div>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ←
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  →
                </button>
              </div>
            </footer>
          )}
        </div>
      </section>
      <RequestStatusDialog
        fallbackFocusRef={currentTabRef}
        request={confirmation}
        busy={Boolean(busyId)}
        error={rowError?.id === confirmation?.row.id ? rowError?.text : null}
        onClose={() => {
          if (!busyId) setConfirmation(null)
        }}
        onConfirm={() => changeStatus(confirmation.row, confirmation.status)}
      />
    </HospitalShell>
  )
}
