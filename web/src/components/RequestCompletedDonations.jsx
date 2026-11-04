import { useEffect, useState } from 'react'
import { cx } from '../utils/cx'
import { listHospitalDonations } from '../services/hospitalDonations'
import { HospitalDonationDetails } from './HospitalDonationDetails'
import { componentLabel } from '../services/requests'

/** A bounded request-linked completion list; `revision` reloads after a successful write. */
export function RequestCompletedDonations({ request, revision = 0, className, ...rest }) {
  const [cursors, setCursors] = useState([null]), [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ state: 'loading', rows: [] }), [selected, setSelected] = useState(null)
  const after = cursors.at(-1)
  useEffect(() => {
    const controller = new AbortController()
    setResult({ state: 'loading', rows: [] })
    listHospitalDonations({ hospitalId: request.hospitalId, requestId: request.id, after }, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ ...data, state: 'ready' }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ state: 'error', error: error.message, rows: [] }) })
    return () => controller.abort()
  }, [request.hospitalId, request.id, revision, after, attempt])
  const loading = result.state === 'loading'
  return <section className={cx('completion-section', className)} aria-label="Completed donations" aria-busy={loading} {...rest}>
    <header className="completion-section-heading"><h3>Completed donations</h3><span>{result.state === 'ready' ? `${result.rows.reduce((sum,row) => sum + (Number(row.units) || 0),0)} units collected on this page` : loading ? 'Loading units…' : 'Units unavailable'}</span></header><p className="muted">Actual collected units recorded for this request.</p>
    {loading && <p role="status">Loading completed donations…</p>}
    {result.state === 'error' && <div role="alert"><p>{result.error}</p><button className="btn" type="button" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>}
    {result.state === 'ready' && !result.rows.length && <div className="completion-empty">No completed donations on this page. They appear here once a donor is marked Completed.</div>}
    <ul className="completion-list">{result.rows.map(row => <li key={row.id}><div><strong>{row.units} {row.units === 1 ? 'unit' : 'units'} · {row.bloodType}</strong><p>{componentLabel(row.component)} · {row.completedAt ? new Date(row.completedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Date not recorded'}</p></div><button className="btn" type="button" aria-label={`View details for donation ${row.id}`} onClick={() => setSelected(row.id)}>View details</button></li>)}</ul>
    <div className="completion-actions"><span>Page {cursors.length}</span><button className="btn" type="button" disabled={loading || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Previous donations</button><button className="btn" type="button" disabled={loading || !result.nextCursor} onClick={() => setCursors(values => [...values, result.nextCursor])}>Next donations</button></div>
    {selected && <HospitalDonationDetails donationId={selected} onClose={() => setSelected(null)} />}
  </section>
}
