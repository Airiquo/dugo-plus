import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { nextDonationStage, validCollectedUnits, canDeferDonation } from '../utils/donationProgress'
import { componentLabel } from '../services/requests'
import { DonationStageTrack, stageDate } from './DonationStageTrack'
import { Field, Input, Textarea } from './Field'
import { Icon } from './Icon'

/** Focused donation attempt. `onSave(stage)` uses the existing server operation; only supplied timestamps are displayed. */
export function DonationProgress({ name, row, request, busy, notice, error, units, onUnits, reason, onReason, onSave, onBack, onResponse, details, onCompleted, completedUnits, className, ...rest }) {
  const [deferring, setDeferring] = useState(false)
  const backButton = useRef(null)
  useEffect(() => { backButton.current?.focus() }, [])
  const next = nextDonationStage(row)
  const stages = ['Responded','Screened','Processing','Completed']
  const index = stages.indexOf(row.donationStage)
  const events = stages.slice(0,index + 1).map((stage,i) => ({stage: i === 0 ? 'Matched' : stage,date:row[['matchedAt','screenedAt','processingAt','completedAt'][i]]})).reverse()
  return <section className={cx('donation-progress-flow',className)} {...rest}>
    <button ref={backButton} type="button" className="btn response-flow-back" disabled={busy} onClick={onBack}>All donor responses</button>
    <div className="hresponses-person"><span className="hresponses-avatar" aria-hidden="true">{row.donor?.fullName?.split(/\s+/).slice(0,2).map(word=>word[0]).join('') || <Icon name="user"/>}</span><div><h3>{row.donor?.fullName || 'Private donor'}</h3><p>{row.donor ? [row.donor.bloodType,row.donor.city].filter(Boolean).join(' · ') : 'Current data-sharing consent is required.'}</p></div><span className="response-stage-pill" data-stage={row.donationStage}>{row.donationStage === 'Responded' ? 'Awaiting screening' : row.donationStage}</span></div>
    <div className="hresponses-contact">{row.donor?.phoneNumber && <a href={`tel:${row.donor.phoneNumber.replace(/[^+0-9]/g,'')}`}><Icon name="phone" size={15}/>{row.donor.phoneNumber}</a>}{row.donor?.email && <a href={`mailto:${row.donor.email}`}>{row.donor.email}</a>}</div>
    <button type="button" className="btn response-flow-view" disabled={busy} onClick={onResponse}>View donor / response</button>
    {details}
    <DonationStageTrack row={row} />
    {notice && <p className="donation-flow-notice" role="status" tabIndex={-1}><Icon name="check" size={18}/>{notice}</p>}
    {error && <p className="donation-flow-error" role="alert">{error}</p>}
    {row.donationStage === 'Completed' ? <>
      <div className="donation-flow-completed"><Icon name="check" size={26}/><div><h4>Donation completed</h4><p>{completedUnits != null ? `${completedUnits} units added to ${componentLabel(request.component)} stock (${row.donor?.bloodType || 'donor blood group'}) and to the donor’s history.` : 'This completed record is final. View its recorded units in completed donations.'}</p></div></div>
      <button className="btn" type="button" onClick={onCompleted}>View in completed donations</button>
    </> : ['Deferred','Rejected'].includes(row.donationStage) ? <div className="donation-flow-ended"><h4>This attempt has ended.</h4>{row.deferralReason && <p>Reason: {row.deferralReason}</p>}<p>It cannot be resumed and adds no stock.</p></div> : !next ? <p className="donation-flow-ended">An accepted response with current donor consent is required to record progress.</p> : deferring ? <form className="donation-next-action donation-deferral-form" onSubmit={event=>{event.preventDefault();if(canDeferDonation(row,reason))onSave('Deferred')}}>
      <p className="care-kicker">Defer · Ends this attempt</p>
      <Field label="Reason for deferral (required)"><Textarea id={`${name}-reason`} required maxLength={2000} value={reason} disabled={busy} onChange={event=>onReason(event.target.value)}/></Field>
      <p>Deferred ends this attempt. It cannot be resumed and adds no stock.</p>
      <button className="btn" data-primary type="submit" disabled={busy || !canDeferDonation(row,reason)}>Record Deferred</button>
      <button className="donation-deferral-cancel" type="button" disabled={busy} onClick={()=>setDeferring(false)}>Cancel — keep the donation going</button>
    </form> : <form className="donation-next-action" onSubmit={event=>{event.preventDefault();if(next !== 'Completed'||validCollectedUnits(units))onSave(next)}}>
      <p className="care-kicker">{next === 'Completed' ? 'Final step' : 'Next step'} · {next}</p>
      <h4>{next === 'Screened' ? 'Has the donor been screened?' : next === 'Processing' ? 'Is the collection being processed?' : 'Record the donation'}</h4>
      {next === 'Completed' ? <>
        <Field label="Actual collected units (required)"><Input id={`${name}-units`} type="number" min="1" step="1" required value={units} disabled={busy} onChange={event=>onUnits(event.target.value)}/></Field>
        <p>Complete with {units || '…'} actual units. This records the donation and adds these units to {componentLabel(request.component)} stock using the donor’s blood group.</p>
      </> : <p>{next === 'Screened' ? 'Record this once screening has actually taken place at your facility.' : 'Record this once the donation has been collected and processing has begun.'}</p>}
      <button type="button" className="btn donation-defer" disabled={busy} onClick={()=>setDeferring(true)}>Defer donor</button>
      <button type="submit" className="btn" data-primary disabled={busy || (next === 'Completed' && !validCollectedUnits(units))}>Record {next}</button>
    </form>}
    {busy && <p role="status">Saving progress…</p>}
    {/* TODO(design): response pages omit recorded stage timestamps; never substitute match times or client-generated dates. */}
    <ol className="donation-stage-log" aria-label="Recorded donation activity">{events.map(event=><li key={event.stage}><time>{stageDate(event.date)}</time><span>{event.stage}</span></li>)}</ol>
  </section>
}
