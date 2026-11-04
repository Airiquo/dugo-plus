import { cx } from '../utils/cx'
import { Icon } from './Icon'

const stages = ['Responded', 'Screened', 'Processing', 'Completed']
const labels = ['Matched', 'Screened', 'Processing', 'Completed']
const dateFields = ['matchedAt', 'screenedAt', 'processingAt', 'completedAt']
export function stageDate(value) {
  const date = value && new Date(value)
  return date && Number.isFinite(+date) ? date.toLocaleString('en-PH', { month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila' }) : 'Date unavailable'
}
/** `compact` renders the card's segmented bar. Expanded steps show only supplied record timestamps. */
export function DonationStageTrack({ row, compact = false, className, ...rest }) {
  const index = stages.indexOf(row.donationStage)
  return <ol className={cx('donation-stage-track', compact && 'donation-stage-track--compact', className)} aria-label="Donation stages" {...rest}>
    {stages.map((stage, i) => {
      const done = index >= i && row.responseStatus === 'Accepted'
      const next = index >= 0 && i === index + 1 && row.responseStatus === 'Accepted'
      return <li key={stage} data-state={done ? 'done' : next ? 'next' : 'future'} aria-current={next ? 'step' : undefined}>
        <span className="donation-stage-dot">{done ? <Icon name="check" size={15} /> : <span />}</span>
        <strong>{labels[i]}</strong>
        {!compact && <small>{done ? stageDate(row[dateFields[i]]) : next ? (stage === 'Completed' ? 'Final step' : 'Next') : '—'}</small>}
      </li>
    })}
  </ol>
}
