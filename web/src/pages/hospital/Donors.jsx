import { useEffect, useRef, useState } from 'react'
import { HospitalShell } from '../../layout/HospitalShell'
import { useAuth } from '../../hooks/useAuth'
import { readHospital } from '../../services/hospitals'
import { listHospitalDonors, exportHospitalDonors } from '../../services/hospitalDonors'
import { BLOOD_TYPES } from '../../services/users'
import { COMPONENTS, componentLabel } from '../../services/requests'
import { useTableSort } from '../../hooks/useTableSort'
import { donorDirectoryColumns, donorHistoryColumns, filterHospitalDonors } from '../../utils/hospitalDonors'
import { Badge, Btn, Card, HospitalPageHeader, RecordFilters, SortControls, Table, TableExport } from '../../components'

const emptyFilters = { search: '', bloodType: 'all', component: 'all', from: '', to: '' }
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }) : 'Not recorded'

/** Completed donors and selected-donor history, restricted to the signed-in facility. */
export default function Donors() {
  const { profile } = useAuth()
  const hospitalId = profile?.hospitalId || ''
  const [hospital, setHospital] = useState(null)
  const [selected, setSelected] = useState(null)
  const previousSelection = useRef(null)
  useEffect(() => {
    if (selected || previousSelection.current) {
      const heading = document.getElementById('page-title')
      heading?.setAttribute('tabindex', '-1')
      heading?.focus()
      heading?.scrollIntoView({ block: 'start' })
    }
    previousSelection.current = selected
  }, [selected])
  useEffect(() => {
    let current = true
    setHospital(null)
    if (hospitalId) readHospital(hospitalId).then(value => { if (current) setHospital(value) }).catch(() => {})
    return () => { current = false }
  }, [hospitalId])
  return <HospitalShell facility={hospital?.name}>
    <HospitalPageHeader eyebrow="People / Completed donations" title={selected ? 'Donor donation history' : 'Your facility’s donors'}
      description={selected ? 'Completed visits at this facility. Other hospitals’ records are excluded.' : 'People who have completed a donation here. Every return visit starts with a person.'}
      actions={selected && <Btn onClick={() => setSelected(null)}>Back to donors</Btn>} />
    {!hospitalId ? <p className="hospital-state" role="status">A linked facility is required to view donors.</p> :
      <DonorRecords key={`${hospitalId}:${selected?.id || ''}`} hospitalId={hospitalId} selected={selected} onView={setSelected} />}
  </HospitalShell>
}

function DonorRecords({ hospitalId, selected, onView }) {
  const history = Boolean(selected)
  const [filters, setFilters] = useState(emptyFilters)
  const [state, setState] = useState({ status: 'loading', rows: [], nextCursor: null })
  const [cursors, setCursors] = useState([null])
  const [attempt, setAttempt] = useState(0)
  const [exportScope, setExportScope] = useState('filtered')
  const { sort, setSort, toggleSort } = useTableSort()
  const after = cursors.at(-1)
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', rows: [], nextCursor: null })
    listHospitalDonors({ hospitalId, ...(selected ? { donorId: selected.id } : {}), after }, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ ...result, status: 'ready' }) })
      .catch(error => { if (!controller.signal.aborted) setState({ status: 'error', rows: [], nextCursor: null, error: error.message }) })
    return () => controller.abort()
  }, [hospitalId, selected?.id, after, attempt])
  const ready = state.status === 'ready'
  const visible = filterHospitalDonors(state.rows, filters, sort, history)
  const scopeLabel = history ? 'donation history on this page' : 'donors on this page'
  const fields = [
    { key: 'bloodType', label: 'Blood group', options: history ? BLOOD_TYPES : [...BLOOD_TYPES, { value: 'private', label: 'Private / unavailable' }] },
    ...(history ? [{ key: 'component', label: 'Component', options: COMPONENTS }] : []),
  ]
  const columns = history ? [
    { key: 'date', header: 'Donation date', render: row => dateLabel(row.donationDate) },
    { key: 'bloodType', header: 'Blood group', render: row => <Badge>{row.bloodType || 'Not recorded'}</Badge> },
    { key: 'component', header: 'Component', render: row => componentLabel(row.component) || 'Not recorded' },
    { key: 'units', header: 'Actual units', render: row => row.units ?? 'Not recorded' },
    { key: 'reference', header: 'References', sortable: false, render: row => <div className="hospital-donors-reference"><span>Donation: {row.id}</span><span>Request: {row.requestId || 'Not recorded'}</span>{row.legacy && <span className="muted">Legacy confirmed record</span>}</div> },
  ] : [
    { key: 'donor', header: 'Donor', render: row => <div className="hospital-donors-reference"><strong>{row.donor?.fullName || 'Profile private'}</strong><span className="muted">{row.id}</span></div> },
    { key: 'bloodType', header: 'Blood group', render: row => <Badge>{row.donor?.bloodType || 'Private'}</Badge> },
    { key: 'contact', header: 'Shared contact', sortable: false, render: row => <div className="hospital-donors-reference">{row.donor ? <><span>{row.donor.email || 'No email shared'}</span><span>{row.donor.phoneNumber || 'No phone shared'}</span><span className="muted">{row.donor.city}</span></> : <span className="muted">Current visit consent and an active profile are required.</span>}</div> },
    { key: 'actions', header: 'History', sortable: false, render: row => <Btn aria-label={`View donor ${row.donor?.fullName || row.id}`} onClick={() => onView(row)}>View donor</Btn> },
  ]
  const summary = Object.entries(filters).filter(([, value]) => value && value !== 'all').map(([key, value]) => `${key}: ${value}`).join(' · ')
  async function getExportRows(_scope, onProgress) {
    const rows = await exportHospitalDonors({ hospitalId, ...(selected ? { donorId: selected.id } : {}) }, onProgress)
    return filterHospitalDonors(rows, exportScope === 'filtered' ? filters : emptyFilters, sort, history)
  }
  return <div className="hospital-donors">
    <aside className="hospital-donors-context">
      <div><p className="hw-eyebrow">{history ? 'One donor · This facility' : 'Completed visits only'}</p><h2>{history ? selected.id : 'A history of showing up.'}</h2></div>
      <p>{history ? 'History includes legacy confirmed donations. These records do not create or change stock.' : 'Accepted and deferred matches are excluded. Names and contacts appear only with current consent for the directory’s completed visit.'}</p>
    </aside>
    <Card className="hospital-inventory-table">
      <header className="hospital-donors-heading"><div><h2>{history ? 'Completed donations' : 'Donor directory'}</h2><p className="muted">{ready ? `${visible.length} matching ${history ? 'records' : 'donors'} on page ${cursors.length}.` : 'Loading facility records…'} Search, filters and sorting apply to this page. Exports include every matching page.</p></div>
        <Btn icon="refresh" disabled={state.status === 'loading'} onClick={() => { setCursors([null]); setAttempt(value => value + 1) }}>Refresh</Btn></header>
      <div className="record-toolbar hospital-donors-toolbar">
      <RecordFilters name={scopeLabel} value={filters} onChange={setFilters} fields={fields} dates={history} disabled={!ready}
        searchPlaceholder={history ? 'Search donation or request ID on this page…' : 'Search shared name, city or donor ID on this page…'} />
      <SortControls name="facility-donors" sort={sort} onChange={setSort} defaultLabel="Reference order · This page"
        fields={columns.filter(column => column.sortable !== false).map(column => ({ key: column.key, label: column.header }))} />
      <TableExport key={`${hospitalId}:${selected?.id || ''}:${exportScope}:${summary}:${sort.key}:${sort.direction}`} name={history ? 'facility-donor-history' : 'facility-donor-directory'} title={history ? `Facility ${hospitalId} · Donor ${selected.id} completed donations` : `Facility ${hospitalId} donor directory`}
        columns={history ? donorHistoryColumns : donorDirectoryColumns} getRows={getExportRows} disabled={!ready}
        filterSummary={`${exportScope === 'filtered' ? summary || 'No filters' : 'All records'} · All authorized pages · ${sort.key || 'Reference'} ${sort.direction}`} >
        <label>Export scope <select className="field" aria-label="Donor export scope" value={exportScope} onChange={event => setExportScope(event.target.value)} disabled={!ready}>
        <option value="filtered">All matching pages · Current filters</option><option value="all">All pages · Clear filters</option>
      </select></label>
      </TableExport></div>
      {state.status === 'loading' && <p className="hospital-state" role="status">Loading {history ? 'completed donations' : 'donors'}…</p>}
      {state.status === 'error' && <div className="hospital-state" role="alert"><p>{state.error}</p><Btn onClick={() => setAttempt(value => value + 1)}>Try again</Btn></div>}
      {ready && (visible.length ? <Table className="hospital-table" mobileCards columns={columns} rows={visible} rowKey={row => row.id} scroll={false} sort={sort} onSort={toggleSort} mobileSort={false} /> :
        <div className="hw-empty"><h3>{state.rows.length ? 'No matches on this page' : history ? 'No completed donations on this page' : 'No completed donors on this page'}</h3><p>{state.nextCursor ? 'Continue to the next page or clear your filters.' : 'Refresh after a completed donation, or clear filters to see available records.'}</p><Btn onClick={() => setFilters(emptyFilters)}>Clear filters</Btn></div>)}
      <nav className="hospital-donors-pager" aria-label={history ? 'Donor history pages' : 'Donor directory pages'}>
        <Btn disabled={!ready || cursors.length === 1} onClick={() => setCursors(value => value.slice(0, -1))}>Previous page</Btn>
        <span aria-live="polite">Page {cursors.length} · {ready ? state.rows.length : '—'} {history ? 'records' : 'donors'} loaded</span>
        <Btn disabled={!ready || !state.nextCursor} onClick={() => { setCursors(value => [...value, state.nextCursor]) }}>Next page</Btn>
      </nav>
    </Card>
  </div>
}
