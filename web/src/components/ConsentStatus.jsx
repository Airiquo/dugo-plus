import { Badge } from './Status'
import { cx } from '../utils/cx'
import { consentStatusLabel, consentTone } from '../utils/consent'

function dateLabel(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : value.toDate?.()
  if (!date) return ''
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/**
 * The donor's hospital-access consent as a status readout.
 *
 * Presentational only: the caller loads `services/consents.js` and owns the
 * actions. It is used on the consent screen and as a summary on the donor
 * privacy page, so a donor sees the same state in both places.
 *
 * @param {{
 *   consent: import('../services/consents').Consent|null,
 *   loading?: boolean,
 *   error?: string,
 *   compact?: boolean,
 * }} props `compact` drops the explanatory sentence, for a summary card.
 */
export function ConsentStatus({ consent, loading, error, compact, className, ...rest }) {
  const status = loading ? 'loading' : error ? 'error' : consent?.status || 'none'
  const label = loading ? 'Checking…' : error ? 'Unavailable' : consentStatusLabel(status)
  const tone = error ? 'rejected' : consentTone(status)
  const granted = dateLabel(consent?.grantedAt)
  const revoked = dateLabel(consent?.revokedAt)

  return (
    <div className={cx('consent-status', compact && 'consent-status-compact', className)} {...rest}>
      <div className="consent-status-head">
        <span className="consent-status-title">Hospital access</span>
        <Badge data-status={tone}>{label}</Badge>
      </div>
      {error ? (
        <p className="consent-status-detail" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="consent-status-detail">Reading your consent record…</p>
      ) : consent?.status === 'granted' ? (
        <p className="consent-status-detail">
          Granted{granted ? ` on ${granted}` : ''} · consent version{' '}
          <span className="consent-status-mono">{consent.consentVersion}</span>
          {!compact && ' Hospitals may open the profile fields listed on the consent screen.'}
        </p>
      ) : consent?.status === 'revoked' ? (
        <p className="consent-status-detail">
          Withdrawn{revoked ? ` on ${revoked}` : ''}. Hospitals can no longer open your profile.
        </p>
      ) : (
        <p className="consent-status-detail">
          No consent recorded. Hospitals cannot open your profile until you grant it.
        </p>
      )}
    </div>
  )
}
