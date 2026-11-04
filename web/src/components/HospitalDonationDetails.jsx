import { lockDialogScroll } from '../utils/dialogScrollLock'
import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { componentLabel } from '../services/requests'
import { readHospitalDonationDetails } from '../services/hospitalDonations'

const date = value => value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'

/** On-demand donation context. `donationId` loads authorized context; optional `movement` supplies the facility log; `onClose` dismisses it. */
export function HospitalDonationDetails({ name = 'donation-context', donationId, movement = null, onClose, className, ...rest }) {
  const ref = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ state: 'loading' })
  useEffect(() => {
    if (!donationId && !movement) return
    const dialog = ref.current, trigger = document.activeElement
    dialog.showModal()
    const unlock = lockDialogScroll()
    return () => { dialog.close(); unlock(); if (trigger?.isConnected) trigger.focus() }
  }, [donationId, movement?.id])
  useEffect(() => {
    if (!donationId) { setResult({ state: 'ready' }); return }
    const controller = new AbortController()
    setResult({ state: 'loading' })
    readHospitalDonationDetails(donationId, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ ...data, state: 'ready' }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ state: 'error', error: error.message }) })
    return () => controller.abort()
  }, [donationId, attempt])
  if (!donationId && !movement) return null
  const id = `${name}-modal`, { donation, donor, request } = result
  return <dialog ref={ref} id={id} className={cx('hresponses', 'completion-details', className)} aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); onClose() }} {...rest}>
    <header className="hresponses-header"><h2 id={`${id}-title`}>{movement ? 'Stock movement details' : 'Completed donation details'}</h2><button className="btn" type="button" onClick={onClose} autoFocus>Close details</button></header>
    <div className="hresponses-content" aria-busy={result.state === 'loading'}>
      {movement && <section><h3>{movement.changeType} · {movement.unitsChanged > 0 ? '+' : ''}{movement.unitsChanged} units</h3><p>{componentLabel(movement.component)} · {movement.bloodType} · {date(movement.createdAt)}</p><p>Reason: {movement.reason || 'Not recorded'}</p><p>Recorded by: {movement.userId || 'Not recorded'}</p><p>Request: {movement.requestId || 'Not linked'}</p><p>Donation: {movement.donationId || 'Not linked'}</p></section>}
      {result.state === 'loading' && <p role="status">Loading donation details…</p>}
      {result.state === 'error' && <div role="alert"><p>{result.error}</p><button className="btn" type="button" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>}
      {donation && <>
        <p className="care-kicker">Completed · {date(donation.completedAt)}</p>
        <h3>{donation.units} {donation.units === 1 ? 'unit' : 'units'} · {donation.bloodType} · {componentLabel(donation.component)}</h3>
        <dl className="completion-facts"><div><dt>Donation</dt><dd>{donation.id}</dd></div><div><dt>Request</dt><dd>{donation.requestId || 'Not recorded'}</dd></div><div><dt>Collected</dt><dd>{date(donation.donationDate)}</dd></div><div><dt>Recorded by</dt><dd>{donation.completedBy || 'Not recorded'}</dd></div></dl>
        {donation.legacy && <p className="muted">Historical confirmation, shown as Completed.</p>}
        <h3>Request context</h3><p>{request ? `${componentLabel(request.component)} · ${request.bloodType} · ${request.quantity} units requested · ${request.status}` : 'Request details are unavailable.'}</p>
        <h3>Donor</h3>{donor ? <><p><strong>{donor.fullName || 'Name not recorded'}</strong> · {donor.bloodType} · {donor.city}</p><p>{donor.phoneNumber || 'Phone not recorded'} · {donor.email || 'Email not recorded'}</p></> : <p className="muted">{result.privacy === 'profile-unavailable' ? 'The donor profile is unavailable.' : 'Donor details are private without current consent.'}</p>}
      </>}
    </div>
  </dialog>
}
