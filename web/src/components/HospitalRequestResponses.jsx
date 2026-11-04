import { lockDialogScroll } from '../utils/dialogScrollLock'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { Field, Input, Textarea } from './Field'
import { Icon } from './Icon'
import { componentLabel } from '../services/requests'
import { RequestCompletedDonations } from './RequestCompletedDonations'
import { screenDonorMatch, confirmDonation } from '../services/inventory'
import { listHospitalResponses } from '../services/hospitalResponses'

const tone = status => ({ Accepted: 'matched', Cleared: 'matched', Declined: 'cancelled', Rejected: 'cancelled', Deferred: 'urgent' })[status] || 'collecting'
function matchedDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Match date not recorded'
  return 'Matched ' + new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Native request response dialog; restores focus to its queue trigger on dismissal. */
export function HospitalRequestResponses({ name = 'hospital-responses', request, onClose, className, ...rest }) {
  const dialogRef = useRef(null), viewButtons = useRef(new Map()), focusAfterSave = useRef(null)
  const [status, setStatus] = useState('')
  const [cursors, setCursors] = useState([null])
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ state: 'loading', rows: [], nextCursor: null })
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [reason, setReason] = useState(''), [units, setUnits] = useState('')
  const after = cursors.at(-1)
  async function save(row, stage) {
    setBusy(true); setError(''); setNotice('')
    try {
      if (stage === 'Completed') await confirmDonation({ matchId: row.id, units: Number(units), acceptanceVersion: row.acceptanceVersion })
      else await screenDonorMatch(row.id, stage, { reason: stage === 'Deferred' ? reason : '', acceptanceVersion: row.acceptanceVersion })
      focusAfterSave.current = row.id
      setNotice(`${stage} saved.`); setSelected(null); setUnits(''); setReason(''); setReload(n => n + 1)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!request) return
    const dialog = dialogRef.current, trigger = document.activeElement
    const unlock = lockDialogScroll()
    dialog.showModal()
    return () => {
      dialog.close()
      unlock()
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
  useEffect(() => {
    if (result.state === 'ready' && focusAfterSave.current) {
      viewButtons.current.get(focusAfterSave.current)?.focus()
      focusAfterSave.current = null
    }
  }, [result])
  if (!request) return null
  const id = `${name}-modal`, loading = result.state === 'loading'
  return (
    <dialog ref={dialogRef} id={id} className={cx('hresponses', className)} aria-labelledby={`${id}-title`}
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }} {...rest}>
      <header className="hresponses-header">
        <div><p className="care-kicker">Request #{request.id.slice(-6).toUpperCase()}</p><h2 id={`${id}-title`}>Donor responses</h2></div>
        <button className="btn" type="button" aria-label="Close donor responses" disabled={busy} onClick={onClose} autoFocus><Icon name="x" size={18} />Close</button>
      </header>
      <div className="hresponses-summary">
        <span className="hreq-blood">{request.bloodType}</span>
        <div><strong>{componentLabel(request.component)}</strong><span>{request.quantity} {request.quantity === 1 ? 'unit' : 'units'} requested</span></div>
        <span className="hreq-status" data-status={request.status}>{({ urgent: 'Open', collecting: 'Collecting', matched: 'Matched', fulfilled: 'Fulfilled', cancelled: 'Cancelled' })[request.status] || request.status}</span>
      </div>
      <div className="hresponses-toolbar">
        <label>Response<select value={status} disabled={busy} onChange={event => { setStatus(event.target.value); setCursors([null]) }}>
          <option value="">All matched donors</option>
          {['Accepted', 'Declined', 'Pending', 'Expired'].map(value => <option key={value} value={value}>{value === 'Accepted' ? 'Responded' : value === 'Declined' ? 'Declined / Withdrew' : value}</option>)}
        </select></label>
        <button className="btn" type="button" disabled={loading || busy} onClick={() => setReload(value => value + 1)}><Icon name="refresh" size={16} />Refresh</button>
      </div>
      <p className="hresponses-privacy"><Icon name="lock" size={15} />Names and contact details appear for accepted donors with active data-sharing consent.</p>
      <div aria-live="polite">{notice && <p className="hresponses-privacy" role="status">{notice}</p>}</div>
      <section className="hresponses-content" aria-label="Request donor responses" aria-busy={loading}>
        {loading ? <div className="hresponses-state" role="status"><Icon name="refresh" size={25} /><h3>Loading donor responses…</h3></div>
        : result.state === 'error' ? <div className="hresponses-state" role="alert"><Icon name="alert" size={26} /><h3>Responses couldn’t be loaded</h3><p>{result.error}</p><button className="btn" type="button" onClick={() => setReload(value => value + 1)}>Try again</button></div>
        : result.rows.length === 0 ? <div className="hresponses-state" role="status"><Icon name="user" size={28} /><h3>{status ? `No ${status.toLowerCase()} donors on this page` : 'No donors matched yet'}</h3><p>{status ? 'Choose another response filter or refresh for updates.' : 'Donors will appear here when matching connects them to this request.'}</p></div>
        : <ul className="hresponses-list">{result.rows.map((row, index) => <li key={row.id}>
          <div className="hresponses-person"><span className="hresponses-avatar" aria-hidden="true">{row.donor?.fullName ? row.donor.fullName.split(/\s+/).slice(0, 2).map(word => word[0]).join('') : <Icon name="user" size={20} />}</span>
            <div><h3>{row.donor?.fullName || (row.donor ? 'Donor name not recorded' : 'Private donor')}</h3><p>{row.donor ? [row.donor.bloodType, row.donor.city].filter(Boolean).join(' · ') || 'Profile details not recorded' : row.privacy === 'profile-unavailable' ? 'Donor profile is unavailable.' : 'Contact details are not shared.'}</p></div>
            <span className="chip" data-status={tone(row.responseStatus)}>{row.responseStatus === 'Pending' ? 'Awaiting response' : row.responseLabel}</span>
          </div>
          <div className="hresponses-contact">{row.donor ? <>
            {row.donor.phoneNumber && <a href={`tel:${row.donor.phoneNumber.replace(/[^+0-9]/g, '')}`}><Icon name="phone" size={15} />{row.donor.phoneNumber}</a>}
            {row.donor.email && <a href={`mailto:${row.donor.email}`}><span>Email</span>{row.donor.email}</a>}
            {!row.donor.phoneNumber && !row.donor.email && <span>No contact details recorded.</span>}
          </> : <span>{row.responseStatus === 'Pending' ? 'This donor has not responded yet.' : 'A response does not grant access without current consent.'}</span>}</div>
          <button ref={node => { if (node) viewButtons.current.set(row.id, node); else viewButtons.current.delete(row.id) }} className="btn" type="button" disabled={busy} aria-expanded={selected === row.id} aria-controls={`${id}-${index}-response`} aria-label={`View donor / response: ${row.donor?.fullName || 'match ' + ((cursors.length - 1) * 25 + index + 1)}`} onClick={() => { setSelected(selected === row.id ? null : row.id); setError(''); setReason(''); setUnits('') }}>View donor / response</button>
          {selected === row.id && <div className="completion-progress" id={`${id}-${index}-response`}>
            <h4>Donation progress · {row.donationStage}</h4>
            {row.deferralReason && <p>Deferral reason: {row.deferralReason}</p>}
            {row.responseStatus === 'Accepted' && row.donor && !['Deferred', 'Rejected', 'Completed'].includes(row.donationStage) ? <>
              <p>Record each stage after it takes place. Completing adds the actual collected units to stock and donor history.</p>
              <div className="completion-actions">
                <button className="btn" type="button" aria-label={`Record Screened for ${row.donor.fullName || "this donor"}`} disabled={busy || row.donationStage !== 'Responded'} onClick={() => save(row, 'Screened')}>Record Screened</button>
                <button className="btn" type="button" aria-label={`Record Processing for ${row.donor.fullName || "this donor"}`} disabled={busy || row.donationStage !== 'Screened'} onClick={() => save(row, 'Processing')}>Record Processing</button>
              </div>
              <form onSubmit={event => { event.preventDefault(); save(row, 'Deferred') }}>
                <Field label="Reason for deferral (required)"><Textarea id={`${id}-reason`} required maxLength={2000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></Field>
                <p className="muted">Deferred ends this attempt. It cannot be resumed and adds no stock.</p>
                <button className="btn" type="submit" aria-label={`Record Deferred for ${row.donor.fullName || "this donor"}`} disabled={busy || !reason.trim()}>Record Deferred</button>
              </form>
              {row.donationStage === 'Processing' && <form onSubmit={event => { event.preventDefault(); save(row, 'Completed') }}>
                <Field label="Actual collected units (required)"><Input id={`${id}-units`} type="number" min="1" step="1" required value={units} disabled={busy} onChange={event => setUnits(event.target.value)} /></Field>
                <p>Complete with {units || '…'} actual units. This records the donation and adds these units to {componentLabel(request.component)} stock using the donor’s blood group.</p>
                <button className="btn" data-primary type="submit" aria-label={`Record Completed for ${row.donor.fullName || "this donor"}`} disabled={busy || !Number.isSafeInteger(Number(units)) || Number(units) < 1}>Record Completed</button>
              </form>}
            </> : <p className="muted">{['Deferred', 'Rejected', 'Completed'].includes(row.donationStage) ? 'This attempt has ended.' : 'An accepted response with current donor consent is required to record progress.'}</p>}
            {busy && <p role="status">Saving progress…</p>}{error && <p role="alert" className="donation-error">{error}</p>}
          </div>}
          <footer><span>{matchedDate(row.matchedAt)}</span>{row.responseStatus === 'Accepted' && <span className="chip" data-status={tone(row.screeningStatus)}>{row.donationStage}</span>}<small>Match {(cursors.length - 1) * 25 + index + 1}</small></footer>
        </li>)}</ul>}
      </section>
      <footer className="hresponses-pagination"><span aria-live="polite">Page {cursors.length}{result.state === 'ready' ? ` · ${result.rows.length} donors shown` : ''}</span><div>
        <button className="btn" type="button" disabled={loading || busy || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Previous</button>
        <button className="btn" type="button" disabled={loading || busy || !result.nextCursor} onClick={() => setCursors(values => [...values, result.nextCursor])}>Next</button>
      </div></footer>
      <RequestCompletedDonations request={request} revision={reload} />
    </dialog>
  )
}
