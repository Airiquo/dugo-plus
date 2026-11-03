import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { Icon } from './Icon'
import { componentLabel } from '../services/requests'
import { listHospitalResponses } from '../services/hospitalResponses'

const tone = status => ({ Accepted: 'matched', Cleared: 'matched', Declined: 'cancelled', Rejected: 'cancelled', Deferred: 'urgent' })[status] || 'collecting'
function matchedDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Match date not recorded'
  return 'Matched ' + new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Native request response dialog; restores focus to its queue trigger on dismissal. */
export function HospitalRequestResponses({ name = 'hospital-responses', request, onClose, className, ...rest }) {
  const dialogRef = useRef(null)
  const [status, setStatus] = useState('')
  const [cursors, setCursors] = useState([null])
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ state: 'loading', rows: [], nextCursor: null })
  const after = cursors.at(-1)
  useEffect(() => {
    if (!request) return
    const dialog = dialogRef.current, trigger = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [request?.id])
  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    setResult({ state: 'loading', rows: [], nextCursor: null })
    listHospitalResponses(request.id, { status, after, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ ...data, state: 'ready' }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ state: 'error', error: error.message, rows: [], nextCursor: null }) })
    return () => controller.abort()
  }, [request?.id, status, after, reload])
  if (!request) return null
  const id = `${name}-modal`, loading = result.state === 'loading'
  return (
    <dialog ref={dialogRef} id={id} className={cx('hresponses', className)} aria-labelledby={`${id}-title`}
      onCancel={event => { event.preventDefault(); onClose() }} {...rest}>
      <header className="hresponses-header">
        <div><p className="care-kicker">Request #{request.id.slice(-6).toUpperCase()}</p><h2 id={`${id}-title`}>Donor responses</h2></div>
        <button className="btn" type="button" aria-label="Close donor responses" onClick={onClose} autoFocus><Icon name="x" size={18} /></button>
      </header>
      <div className="hresponses-summary">
        <span className="hreq-blood">{request.bloodType}</span>
        <div><strong>{componentLabel(request.component)}</strong><span>{request.quantity} {request.quantity === 1 ? 'unit' : 'units'} requested</span></div>
        <span className="hreq-status" data-status={request.status}>{({ urgent: 'Open', collecting: 'Collecting', matched: 'Matched', fulfilled: 'Fulfilled', cancelled: 'Cancelled' })[request.status] || request.status}</span>
      </div>
      <div className="hresponses-toolbar">
        <label>Response<select value={status} onChange={event => { setStatus(event.target.value); setCursors([null]) }}>
          <option value="">All matched donors</option>
          {['Accepted', 'Declined', 'Pending', 'Expired'].map(value => <option key={value}>{value}</option>)}
        </select></label>
        <button className="btn" type="button" disabled={loading} onClick={() => setReload(value => value + 1)}><Icon name="refresh" size={16} />Refresh</button>
      </div>
      <p className="hresponses-privacy"><Icon name="lock" size={15} />Names and contact details appear for accepted donors with active data-sharing consent.</p>
      <section className="hresponses-content" aria-label="Request donor responses" aria-busy={loading}>
        {loading ? <div className="hresponses-state" role="status"><Icon name="refresh" size={25} /><h3>Loading donor responses…</h3></div>
        : result.state === 'error' ? <div className="hresponses-state" role="alert"><Icon name="alert" size={26} /><h3>Responses couldn’t be loaded</h3><p>{result.error}</p><button className="btn" type="button" onClick={() => setReload(value => value + 1)}>Try again</button></div>
        : result.rows.length === 0 ? <div className="hresponses-state" role="status"><Icon name="user" size={28} /><h3>{status ? `No ${status.toLowerCase()} donors on this page` : 'No donors matched yet'}</h3><p>{status ? 'Choose another response filter or refresh for updates.' : 'Donors will appear here when matching connects them to this request.'}</p></div>
        : <ul className="hresponses-list">{result.rows.map((row, index) => <li key={row.id}>
          <div className="hresponses-person"><span className="hresponses-avatar" aria-hidden="true">{row.donor?.fullName ? row.donor.fullName.split(/\s+/).slice(0, 2).map(word => word[0]).join('') : <Icon name="user" size={20} />}</span>
            <div><h3>{row.donor?.fullName || (row.donor ? 'Donor name not recorded' : 'Private donor')}</h3><p>{row.donor ? [row.donor.bloodType, row.donor.city].filter(Boolean).join(' · ') || 'Profile details not recorded' : row.privacy === 'profile-unavailable' ? 'Donor profile is unavailable.' : 'Contact details are not shared.'}</p></div>
            <span className="chip" data-status={tone(row.responseStatus)}>{row.responseStatus === 'Pending' ? 'Awaiting response' : row.responseStatus}</span>
          </div>
          <div className="hresponses-contact">{row.donor ? <>
            {row.donor.phoneNumber && <a href={`tel:${row.donor.phoneNumber.replace(/[^+0-9]/g, '')}`}><Icon name="phone" size={15} />{row.donor.phoneNumber}</a>}
            {row.donor.email && <a href={`mailto:${row.donor.email}`}><span>Email</span>{row.donor.email}</a>}
            {!row.donor.phoneNumber && !row.donor.email && <span>No contact details recorded.</span>}
          </> : <span>{row.responseStatus === 'Pending' ? 'This donor has not responded yet.' : 'A response does not grant access without current consent.'}</span>}</div>
          <footer><span>{matchedDate(row.matchedAt)}</span>{row.responseStatus === 'Accepted' && <span className="chip" data-status={tone(row.screeningStatus)}>{row.screeningStatus || 'Not screened'}</span>}<small>Match {(cursors.length - 1) * 25 + index + 1}</small></footer>
        </li>)}</ul>}
      </section>
      <footer className="hresponses-pagination"><span aria-live="polite">Page {cursors.length}{result.state === 'ready' ? ` · ${result.rows.length} donors shown` : ''}</span><div>
        <button className="btn" type="button" disabled={loading || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Previous</button>
        <button className="btn" type="button" disabled={loading || !result.nextCursor} onClick={() => setCursors(values => [...values, result.nextCursor])}>Next</button>
      </div></footer>
    </dialog>
  )
}
