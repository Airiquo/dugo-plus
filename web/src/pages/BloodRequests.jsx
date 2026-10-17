import { useMemo, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import { Btn, Card, Chip, Field, Input, PageHeader, Select, Table } from '../components'
import {
  BLOOD_TYPES,
  COMPONENTS,
  REQUESTS,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  componentLabel,
} from '../data/requests'
/**
 * Blood Requests — `/admin/blood-requests`.
 *
 * Translated from `light/admin-blood-requests.html` by composing the shared
 * components (see `Gallery.jsx` for usage) and rendering from
 * `web/src/data/requests.js` rather than hardcoded markup.
 *
 * Behaviour:
 * - Search and the four filters narrow the table; "Clear filters" stays disabled
 *   until something is set, matching the mockup's resting state.
 * - Pagination is presentational: it mirrors the mockup's demo state ("1–5 of 18",
 *   pages 1–4), because paging belongs with the API, which does not exist yet.
 * - The date range is captured but not applied: the fixtures carry display text
 *   ("08:12 today"), not timestamps to compare against.
 */

/** Filters start at the mockup's `all` / empty resting state. */
const NO_FILTERS = {
  search: '',
  status: 'all',
  bloodType: 'all',
  component: 'all',
  priority: 'all',
  from: '',
  to: '',
}

/**
 * Filter options with the mockup's leading "All …" entry.
 * @param {string} allLabel - label of the "all" entry
 * @param {Array<string|{value: string, label: string}>} values
 */
function options(allLabel, values) {
  return [
    { value: 'all', label: allLabel },
    ...values.map((v) => (typeof v === 'string' ? { value: v, label: v } : v)),
  ]
}

const STATUS_OPTIONS = options('All statuses', REQUEST_STATUSES)
const BLOOD_TYPE_OPTIONS = options('All types', BLOOD_TYPES)
const COMPONENT_OPTIONS = options(
  'All components',
  COMPONENTS.map((c) => ({ value: c.value, label: c.label })),
)
const PRIORITY_OPTIONS = options('All priorities', REQUEST_PRIORITIES)

/** Table columns; `cellProps` is a function because the attributes vary per row. */
const COLUMNS = [
  { key: 'id', header: 'Request ID' },
  { key: 'patient', header: 'Patient' },
  {
    key: 'bloodType',
    header: 'Blood type',
    cellProps: (r) => ({ 'data-blood-type': r.bloodType }),
  },
  {
    key: 'component',
    header: 'Component',
    cellProps: (r) => ({ 'data-component': r.component }),
    render: (r) => componentLabel(r.component),
  },
  { key: 'qty', header: 'Qty' },
  {
    key: 'priority',
    header: 'Priority',
    cellProps: (r) => ({ 'data-priority': r.priority }),
    render: (r) => <Chip data-priority={r.priority}>{r.priority}</Chip>,
  },
  {
    key: 'status',
    header: 'Status',
    cellProps: (r) => ({ 'data-status': r.status }),
    render: (r) => <Chip data-status={r.status}>{r.status}</Chip>,
  },
  { key: 'requested', header: 'Requested' },
  { key: 'requiredBy', header: 'Required by' },
  { key: 'source', header: 'Source' },
  {
    key: 'actions',
    header: 'Actions',
    cellProps: (r) => ({ id: `request-row-${r.id}-actions` }),
    render: (r) => (
      <div className="row">
        <Btn id={`request-row-${r.id}-view-btn`}>View</Btn>
        <Btn id={`request-row-${r.id}-match-btn`}>Match</Btn>
        <Btn>Cancel</Btn>
      </div>
    ),
  },
]

export default function BloodRequests() {
  const [filters, setFilters] = useState(NO_FILTERS)
  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const clearFilters = () => setFilters(NO_FILTERS)
  const hasFilters = Object.keys(NO_FILTERS).some((key) => filters[key] !== NO_FILTERS[key])

  const rows = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return REQUESTS.filter((r) => {
      if (filters.status !== 'all' && r.status !== filters.status) return false
      if (filters.bloodType !== 'all' && r.bloodType !== filters.bloodType) return false
      if (filters.component !== 'all' && r.component !== filters.component) return false
      if (filters.priority !== 'all' && r.priority !== filters.priority) return false
      if (!query) return true
      const haystack = [r.id, r.patient, r.source, componentLabel(r.component)]
      return haystack.some((value) => value.toLowerCase().includes(query))
    })
  }, [filters])

  return (
    <AppShell>
      <PageHeader title="Blood Requests" />
      <div id="page-body">
        <div id="requests">
          <div id="requests-toolbar" className="row row-between">
            <Field id="requests-search" label="Search">
              <Input
                type="search"
                name="requests-search"
                placeholder="Request ID, patient, ward, source"
                value={filters.search}
                onChange={setFilter('search')}
              />
            </Field>
            <Btn id="requests-new-btn" icon="plus">
              New request
            </Btn>
          </div>

          <div id="requests-filters">
            <Field label="Status">
              <Select
                id="requests-filter-status"
                options={STATUS_OPTIONS}
                value={filters.status}
                onChange={setFilter('status')}
              />
            </Field>
            <Field label="Blood type">
              <Select
                id="requests-filter-blood-type"
                options={BLOOD_TYPE_OPTIONS}
                value={filters.bloodType}
                onChange={setFilter('bloodType')}
              />
            </Field>
            <Field label="Component">
              <Select
                id="requests-filter-component"
                options={COMPONENT_OPTIONS}
                value={filters.component}
                onChange={setFilter('component')}
              />
            </Field>
            <Field label="Priority">
              <Select
                id="requests-filter-priority"
                options={PRIORITY_OPTIONS}
                value={filters.priority}
                onChange={setFilter('priority')}
              />
            </Field>
            <Field id="requests-filter-date-range" label="Date range">
              <span className="row">
                <Input
                  type="date"
                  name="requests-filter-date-from"
                  value={filters.from}
                  onChange={setFilter('from')}
                />
                <span>to</span>
                <Input
                  type="date"
                  name="requests-filter-date-to"
                  value={filters.to}
                  onChange={setFilter('to')}
                />
              </span>
            </Field>
            <Btn id="requests-filter-clear" disabled={!hasFilters} onClick={clearFilters}>
              Clear filters
            </Btn>
          </div>

          {rows.length > 0 ? (
            <>
              <Table
                id="requests-table"
                columns={COLUMNS}
                rows={rows}
                rowKey={(r) => r.id}
                rowProps={(r) => ({
                  id: `request-row-${r.id}`,
                  'data-status': r.status,
                  'data-priority': r.priority,
                  'data-blood-type': r.bloodType,
                  'data-component': r.component,
                  'data-source': r.sourceKind,
                })}
              />
              <div id="requests-pagination" className="row row-between">
                <span id="requests-pagination-info">1–5 of 18</span>
                <div className="row">
                  <Btn id="requests-pagination-prev" disabled>
                    Prev
                  </Btn>
                  {[1, 2, 3, 4].map((page) => (
                    <Btn
                      key={page}
                      id={`requests-pagination-page-${page}`}
                      data-active={page === 1 ? 'true' : 'false'}
                    >
                      {page}
                    </Btn>
                  ))}
                  <Btn id="requests-pagination-next">Next</Btn>
                </div>
              </div>
            </>
          ) : (
            <Card id="requests-empty">
              <span className="muted">No requests match these filters.</span>
              <Btn onClick={clearFilters}>Clear filters</Btn>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}
