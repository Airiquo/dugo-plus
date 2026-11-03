import { useEffect, useRef, useState } from 'react'
import { cx } from '../utils/cx'
import { Icon } from './Icon'
import { listGuidelines } from '../services/guidelines'
import {
  componentName,
  requestDistance,
  directionsUrl,
  isAvailableRequest,
  isActiveCommitment,
} from '../utils/donorRequests'
import { donationTypeForComponent } from '../utils/matching'
import { toDate } from '../utils/eligibility'

/** Accessible request dialog; acceptance requires guidelines and two explicit consents. */
export function DonorRequestDetails({
  name = 'donor-request',
  item,
  position,
  activeCommitment,
  eligibility,
  busy,
  error,
  onClose,
  onRespond,
  className,
  ...rest
}) {
  const ref = useRef(null),
    [step, setStep] = useState('details'),
    [guidelines, setGuidelines] = useState({ status: 'loading', rows: [] })
  const [ack, setAck] = useState(false),
    [sharing, setSharing] = useState(false),
    [screening, setScreening] = useState(false)
  useEffect(() => {
    if (!item) return
    const dialog = ref.current,
      trigger = document.activeElement
    setStep('details')
    setAck(false)
    setSharing(false)
    setScreening(false)
    setGuidelines({ status: 'loading', rows: [] })
    let current = true
    listGuidelines(
      donationTypeForComponent(item.request.component) ||
        item.match.donationTypeId,
    )
      .then((rows) => {
        if (current) setGuidelines({ status: 'ready', rows })
      })
      .catch(() => {
        if (current) setGuidelines({ status: 'error', rows: [] })
      })
    dialog.showModal()
    return () => {
      current = false
      if (dialog.open) dialog.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [item?.match.id])
  if (!item) return null
  const { request, hospital, match } = item,
    id = `${name}-modal`,
    available = isAvailableRequest(item)
  const blocked = activeCommitment && activeCommitment.match.id !== match.id
  const url = directionsUrl(position, item.facility),
    date = toDate(request.createdAt)
  const phone = hospital?.contactNumber?.replace(/[^+\d]/g, '')
  return (
    <dialog
      ref={ref}
      id={id}
      className={cx('donation-details', className)}
      aria-labelledby={`${id}-title`}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      {...rest}
    >
      <header className="donation-details-header">
        <span className="donation-eyebrow">
          {step === 'details' ? 'Request details' : 'Before you commit'}
        </span>
        <button
          className="btn donation-icon-button"
          type="button"
          aria-label="Close request details"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="x" size={20} />
        </button>
      </header>
      <div className="donation-details-body">
        <div className="donation-detail-identity">
          <span className="donation-blood">{request.bloodType}</span>
          <div>
            <p className="donation-eyebrow">
              {componentName(request.component)}
            </p>
            <h2 id={`${id}-title`}>
              {hospital?.name || request.hospitalName || 'Requesting hospital'}
            </h2>
            <p>
              <Icon name="pin" size={14} />
              {requestDistance(item.distance)}
            </p>
          </div>
        </div>
        {step === 'details' ? (
          <>
            <div className="donation-detail-facts">
              <div>
                <span>Units requested</span>
                <strong>
                  {request.quantity} {request.quantity === 1 ? 'unit' : 'units'}
                </strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>
                  {request.urgencyLevel === 'stat'
                    ? 'Immediate'
                    : request.urgencyLevel === 'urgent'
                      ? 'Urgent'
                      : 'Routine'}
                </strong>
              </div>
              <div>
                <span>Posted</span>
                <strong>
                  {date
                    ? date.toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Date unavailable'}
                </strong>
              </div>
              <div>
                <span>Your response</span>
                <strong>
                  {match.responseStatus === 'Pending'
                    ? 'Not answered'
                    : match.responseStatus}
                </strong>
              </div>
            </div>
            <section className="donation-detail-section">
              <h3>Where to go</h3>
              <p>
                {hospital?.address ||
                  'Address not provided. Contact the hospital before travelling.'}
              </p>
              <div className="donation-inline-actions">
                {url && (
                  <a
                    className="btn"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="compass" />
                    Get directions
                  </a>
                )}
                {phone && (
                  <a className="btn" href={`tel:${phone}`}>
                    <Icon name="phone" />
                    Call hospital
                  </a>
                )}
              </div>
            </section>
            <section className="donation-detail-section">
              <h3>What happens next</h3>
              <ol className="donation-next-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Choose this request</strong>
                    <p>
                      Review the guidelines and give your consent. You can
                      commit to one donation at a time.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Arrange your visit</strong>
                    <p>
                      Contact the hospital to confirm where and when to arrive.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Complete the screening</strong>
                    <p>
                      Final verification at the hospital: physical screening,
                      blood tests and your medical history. The donation is
                      recorded only after you’re cleared.
                    </p>
                  </div>
                </li>
              </ol>
            </section>
            {eligibility && (
              <p
                className="donation-notice"
                data-tone={eligibility.eligible ? 'good' : eligibility.status}
              >
                <Icon name="shield" size={18} />
                <span>
                  <strong>{eligibility.label}</strong> {eligibility.detail}
                </span>
              </p>
            )}
            {blocked && (
              <p className="donation-notice">
                <Icon name="clock" size={18} />
                <span>
                  You already have an active donation at{' '}
                  <strong>
                    {activeCommitment.hospital?.name ||
                      activeCommitment.request.hospitalName}
                  </strong>
                  . Complete it or contact the hospital before accepting
                  another.
                </span>
              </p>
            )}
            <p className="donation-reference">
              Request #{request.id.slice(-12).toUpperCase()} ·{' '}
              {['fulfilled', 'cancelled'].includes(request.status)
                ? 'Closed'
                : 'Open'}
            </p>
          </>
        ) : step === 'withdraw' ? (
          <>
            <h3>Can’t make this donation?</h3>
            <p className="donation-detail-intro">
              Withdrawing removes this commitment and revokes the consent you
              gave for it. Your shared location is cleared. The hospital will
              see your updated response.
            </p>
            <p className="donation-notice">
              If you’ve already arranged a visit, please also call the hospital
              so its team can plan ahead.
            </p>
          </>
        ) : (
          <>
            <p className="donation-detail-intro">
              You’re choosing to help at{' '}
              <strong>{hospital?.name || request.hospitalName}</strong>. Take a
              moment to review these details.
            </p>
            {guidelines.status === 'loading' && (
              <p role="status">Loading donation guidelines…</p>
            )}
            {guidelines.status === 'error' && (
              <p role="alert" className="donation-error">
                Guidelines could not be loaded. Close this request and try
                again.
              </p>
            )}
            {guidelines.rows.map((row) => (
              <section className="donation-guideline" key={row.id}>
                <h3>{row.title}</h3>
                <p>{row.description}</p>
              </section>
            ))}
            {guidelines.status === 'ready' && !guidelines.rows.length && (
              <p className="donation-notice">
                No guidelines have been published for this donation. Contact the
                hospital before committing.
              </p>
            )}
            <label className="donation-consent">
              <input
                type="checkbox"
                checked={ack}
                onChange={(event) => setAck(event.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>I’ve read the donation guidelines</strong>
                <small>
                  I understand that the hospital will confirm my eligibility.
                </small>
              </span>
            </label>
            <label className="donation-consent">
              <input
                type="checkbox"
                checked={sharing}
                onChange={(event) => setSharing(event.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>Share my details with this hospital</strong>
                <small>
                  I consent to sharing my contact details and the location shown
                  here to coordinate this donation.
                </small>
              </span>
            </label>
            <label className="donation-consent">
              <input
                type="checkbox"
                checked={screening}
                onChange={(event) => setScreening(event.target.checked)}
                disabled={busy}
              />
              <span>
                <strong>I agree to pre-donation screening</strong>
                <small>
                  I consent to eligibility screening and recording its outcome
                  in my donation history.
                </small>
              </span>
            </label>
            <p className="donation-notice">
              <Icon name="shield" size={18} />
              <span>
                One commitment at a time. Other requests remain available to
                browse while you prepare for this donation.
              </span>
            </p>
          </>
        )}
        {error && (
          <p className="donation-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="donation-details-footer">
        {step === 'details' ? (
          <>
            {available ? (
              <>
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => onRespond('Declined')}
                >
                  {busy ? 'Saving…' : 'Not this time'}
                </button>
                <button
                  className="btn"
                  data-primary
                  type="button"
                  disabled={
                    busy ||
                    blocked ||
                    !item.compatible ||
                    !eligibility?.eligible
                  }
                  onClick={() => setStep('consent')}
                >
                  {blocked ? 'Donation already planned' : 'I can help'}
                  <Icon name="arrow-right" />
                </button>
              </>
            ) : (
              <>
                <button className="btn" type="button" onClick={onClose}>
                  Back to requests
                </button>
                {isActiveCommitment(item) && (
                  <button
                    className="donation-text-link"
                    type="button"
                    onClick={() => setStep('withdraw')}
                  >
                    I can’t attend
                  </button>
                )}
              </>
            )}
          </>
        ) : step === 'withdraw' ? (
          <>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => setStep('details')}
            >
              Keep my donation
            </button>
            <button
              className="btn"
              data-primary
              type="button"
              disabled={busy}
              onClick={() => onRespond('Declined')}
            >
              {busy ? 'Withdrawing…' : 'Withdraw from donation'}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => setStep('details')}
            >
              Back
            </button>
            <button
              className="btn"
              data-primary
              type="button"
              disabled={
                busy ||
                blocked ||
                !available ||
                !ack ||
                !sharing ||
                !screening ||
                guidelines.status !== 'ready' ||
                !guidelines.rows.length
              }
              onClick={() =>
                onRespond('Accepted', {
                  acknowledged: ack,
                  dataSharingConsent: sharing,
                  screeningConsent: screening,
                })
              }
            >
              {busy ? 'Confirming…' : 'Confirm my donation'}
              <Icon name="check" />
            </button>
          </>
        )}
      </footer>
    </dialog>
  )
}
