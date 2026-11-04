import { useConfirmation } from '../hooks/useConfirmation'
import { lockDialogScroll } from '../utils/dialogScrollLock'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { nextDonationStage, validCollectedUnits, canDeferDonation } from '../utils/donationProgress'
import { Icon } from './Icon'
import { DonationStageTrack } from './DonationStageTrack'
import { DonationProgress } from './DonationProgress'
import { CopyId } from './CopyId'
import { HospitalDonationDetails } from './HospitalDonationDetails'
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
  const confirm = useConfirmation()
  const dialogRef = useRef(null), viewButtons = useRef(new Map()), focusAfterSave = useRef(null)
  const [status, setStatus] = useState('')
  const [cursors, setCursors] = useState([null])
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ state: 'loading', rows: [], nextCursor: null })
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [reason, setReason] = useState(''), [units, setUnits] = useState('')
  const [detail, setDetail] = useState(null), [donationId, setDonationId] = useState(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState(null), [completion, setCompletion] = useState(null)
  const completedSection = useRef(null)
  const after = cursors.at(-1)
  async function save(row, stage) {
    if (busy || result.state === 'loading') return
    if (stage === 'Deferred' ? !canDeferDonation(row,reason) : stage !== nextDonationStage(row)) return
    if (stage === 'Completed' && !validCollectedUnits(units)) return
    if (!await confirm({
      title: `Record ${stage.toLowerCase()}?`,
      description: stage === 'Completed'
        ? `Complete ${Number(units)} units of ${componentLabel(request.component)} for ${row.donor?.fullName || 'this donor'}. This updates stock and donor history.`
        : stage === 'Deferred'
          ? `End this donation attempt with the reason: ${reason.trim()}. No stock is added.`
          : `Record ${stage.toLowerCase()} for ${row.donor?.fullName || 'this donor'}. This updates the donation’s progress.`,
      confirmLabel: `Confirm ${stage.toLowerCase()}`,
    })) return
    setBusy(true); setError(''); setNotice('')
    try {
      let saved
      if (stage === 'Completed') saved = await confirmDonation({ matchId: row.id, units: Number(units), acceptanceVersion: row.acceptanceVersion })
      else await screenDonorMatch(row.id, stage, { reason: stage === 'Deferred' ? reason : '', acceptanceVersion: row.acceptanceVersion })
      focusAfterSave.current = row.id
      setNotice(`${stage === 'Screened' ? 'Screening' : stage} saved.`); setSelectedSnapshot({...row,donationStage:stage,...(stage === 'Deferred' ? {deferralReason:reason} : {})}); if(stage === 'Completed')setCompletion(saved); setUnits(''); setReason(''); setReload(n => n + 1)
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
      if(selected) dialogRef.current?.querySelector('.donation-flow-notice')?.focus()
      else viewButtons.current.get(focusAfterSave.current)?.focus()
      focusAfterSave.current = null
    }
  }, [result])
  if (!request) return null
  const id = `${name}-modal`, loading = result.state === 'loading'
  const selectedRow = result.rows.find(row=>row.id===selected) || selectedSnapshot
  const responseDetails = row => <section className="response-readonly" aria-label="Donor response details"><h4>Response details</h4><dl className="completion-facts"><div><dt>Response</dt><dd>{row.responseLabel || row.responseStatus}</dd></div><div><dt>Matched</dt><dd>{matchedDate(row.matchedAt)}</dd></div><div><dt>Match ID</dt><dd><CopyId value={row.id} label="match ID" /></dd></div><div><dt>Guidelines acknowledged</dt><dd>{row.acknowledgedAt ? matchedDate(row.acknowledgedAt).replace('Matched ','') : 'Not recorded'}</dd></div></dl>{row.deferralReason && <p>Deferral reason: {row.deferralReason}</p>}<button type="button" className="btn" onClick={()=>setDetail(null)}>Close response details</button></section>
  return (
    <dialog ref={dialogRef} id={id} className={cx('hresponses', className)} aria-labelledby={`${id}-title`}
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }} {...rest}>
      <header className="hresponses-header">
        <div><p className="care-kicker">Request #{request.id.slice(-6).toUpperCase()}</p><h2 id={`${id}-title`}>Donor responses</h2></div>
        <button className="btn" type="button" aria-label="Close donor responses" disabled={busy} onClick={onClose} autoFocus><Icon name="x" size={18} />Close</button>
      </header>
      <div className="hresponses-summary">
        <span className="hreq-blood">{request.bloodType}</span>
        <div><strong>{componentLabel(request.component)}</strong><span>{request.quantity} {request.quantity === 1 ? 'unit' : 'units'} requested · Actual collected units below</span></div>
        <span className="hreq-status" data-status={request.status}>{({ urgent: 'Open', collecting: 'Collecting', matched: 'Matched', fulfilled: 'Fulfilled', cancelled: 'Cancelled' })[request.status] || request.status}</span>
      </div>
      {!selected && <div className="hresponses-toolbar">
        <label>Response<select value={status} disabled={busy} onChange={event => { setStatus(event.target.value); setCursors([null]) }}>
          <option value="">All matched donors</option>
          {['Accepted', 'Declined', 'Pending', 'Expired'].map(value => <option key={value} value={value}>{value === 'Accepted' ? 'Responded' : value === 'Declined' ? 'Declined / Withdrew' : value}</option>)}
        </select></label>
        <button className="btn" type="button" disabled={loading || busy} onClick={() => setReload(value => value + 1)}><Icon name="refresh" size={16} />Refresh</button>
      </div>}
      <p className="hresponses-privacy"><Icon name="lock" size={15} />Names and contact details appear for accepted donors with active data-sharing consent.</p>
      <div aria-live="polite">{notice && !selected && <p className="hresponses-privacy" role="status">{notice}</p>}</div>
      <section className="hresponses-content" aria-label="Request donor responses" aria-busy={loading}>
        {selected && selectedRow ? <>
          <DonationProgress id={`${id}-progress`} name={`${name}-progress`} row={selectedRow} request={request} busy={busy || loading || result.state === 'error'} notice={notice} error={error || (result.state === 'error' ? result.error : '')} units={units} onUnits={setUnits} reason={reason} onReason={setReason} onSave={stage=>save(selectedRow,stage)} onBack={()=>{setSelected(null);setNotice('');setDetail(null);requestAnimationFrame(()=>viewButtons.current.get(selected)?.focus())}} onResponse={()=>setDetail(detail === selected ? null : selected)} details={detail === selected ? responseDetails(selectedRow) : null} onCompleted={()=>{setSelected(null);setDetail(null);requestAnimationFrame(()=>{completedSection.current?.scrollIntoView({block:'start'});completedSection.current?.focus({preventScroll:true})})}} completedUnits={completion?.donationId === selected ? completion.units : null} />
          {result.state === 'error' && <button className="btn" type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Retry loading progress</button>}
        </> : loading ? <div className="hresponses-state" role="status"><Icon name="refresh" size={25} /><h3>Loading donor responses…</h3></div>
        : result.state === 'error' ? <div className="hresponses-state" role="alert"><Icon name="alert" size={26} /><h3>Responses couldn’t be loaded</h3><p>{result.error}</p><button className="btn" type="button" onClick={() => setReload(value => value + 1)}>Try again</button></div>
        : result.rows.length === 0 ? <div className="hresponses-state" role="status"><Icon name="user" size={28} /><h3>{status ? `No ${status.toLowerCase()} donors on this page` : 'No donors matched yet'}</h3><p>{status ? 'Choose another response filter or refresh for updates.' : 'Donors will appear here when matching connects them to this request.'}</p></div>
        : <ul className="hresponses-list">{result.rows.map((row, index) => <li key={row.id}>
          <div className="hresponses-person"><span className="hresponses-avatar" aria-hidden="true">{row.donor?.fullName ? row.donor.fullName.split(/\s+/).slice(0, 2).map(word => word[0]).join('') : <Icon name="user" size={20} />}</span>
            <div><h3>{row.donor?.fullName || (row.donor ? 'Donor name not recorded' : 'Private donor')}</h3><p>{row.donor ? [row.donor.bloodType, row.donor.city].filter(Boolean).join(' · ') || 'Profile details not recorded' : row.privacy === 'profile-unavailable' ? 'Donor profile is unavailable.' : 'Contact details are not shared.'}</p></div>
            <span className="response-stage-pill" data-stage={row.donationStage}>{row.responseStatus === 'Pending' ? 'Awaiting response' : row.responseStatus !== 'Accepted' ? row.responseLabel : row.donationStage === 'Responded' ? 'Awaiting screening' : row.donationStage}</span>
          </div>
          <div className="hresponses-contact">{row.donor ? <>
            {row.donor.phoneNumber && <a href={`tel:${row.donor.phoneNumber.replace(/[^+0-9]/g, '')}`}><Icon name="phone" size={15} />{row.donor.phoneNumber}</a>}
            {row.donor.email && <a href={`mailto:${row.donor.email}`}><span>Email</span>{row.donor.email}</a>}
            {!row.donor.phoneNumber && !row.donor.email && <span>No contact details recorded.</span>}
          </> : <span>{row.responseStatus === 'Pending' ? 'This donor has not responded yet.' : 'A response does not grant access without current consent.'}</span>}</div>
          {row.responseStatus === 'Accepted' && <DonationStageTrack row={row} compact />}
          <div className="response-card-meta"><span>Response: {row.responseLabel || row.responseStatus} · {matchedDate(row.matchedAt)}</span><small>Match {(cursors.length - 1) * 25 + index + 1}</small></div>
          <div className="response-card-actions">
            <button className="btn" type="button" disabled={busy} aria-expanded={detail === row.id} aria-label={`View donor / response: ${row.donor?.fullName || 'match ' + ((cursors.length - 1) * 25 + index + 1)}`} onClick={() => setDetail(detail === row.id ? null : row.id)}>View donor / response</button>
            {row.donationStage === 'Completed' ? <button className="btn" type="button" disabled={busy} onClick={() => setDonationId(row.id)}>View donation <Icon name="arrow-right" size={16} /></button> : <button ref={node => { if (node) viewButtons.current.set(row.id, node); else viewButtons.current.delete(row.id) }} className="btn" data-primary type="button" disabled={busy || row.responseStatus !== 'Accepted' || !row.donor || ['Deferred','Rejected'].includes(row.donationStage)} aria-label={`Manage donation for ${row.donor?.fullName || 'this match'}`} aria-expanded={selected === row.id} aria-controls={`${id}-progress`} onClick={() => { setSelected(row.id); setSelectedSnapshot(row); setDetail(null); setError(''); setNotice(''); setReason(''); setUnits('') }}>Manage donation <Icon name="arrow-right" size={16} /></button>}
          </div>
          {detail === row.id && responseDetails(row)}
        </li>)}</ul>}
      <div ref={completedSection} tabIndex={-1} hidden={Boolean(selected)}><RequestCompletedDonations request={request} revision={reload} /></div>
      </section>
      {!selected && <footer className="hresponses-pagination"><span aria-live="polite">Page {cursors.length}{result.state === 'ready' ? ` · ${result.rows.length} ${result.rows.length === 1 ? "donor" : "donors"} shown` : ''}</span><div>
        <button className="btn" type="button" disabled={loading || busy || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Previous</button>
        <button className="btn" type="button" disabled={loading || busy || !result.nextCursor} onClick={() => setCursors(values => [...values, result.nextCursor])}>Next</button>
      </div></footer>}
      {/* TODO(design): the response API supplies no request-wide collected total; the completion list labels its page sum. */}
      {donationId && <HospitalDonationDetails donationId={donationId} onClose={() => setDonationId(null)} />}
    </dialog>
  )
}
