import { cx } from '../utils/cx'

/** Equivalent sorting controls for card/timeline lists. `fields`: [{key,label}]. */
export function SortControls({ name, sort, onChange, fields, defaultLabel = 'Recommended order', className, ...rest }) {
  return <div className={cx('record-sort-controls', className)} {...rest}>
    <label htmlFor={`${name}-sort-key`}>Sort by</label>
    <select id={`${name}-sort-key`} value={sort.key || ''} onChange={event => onChange({ key: event.target.value || null, direction: 'asc' })}>
      <option value="">{defaultLabel}</option>{fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
    </select>
    <button type="button" className="btn" disabled={!sort.key} onClick={() => onChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
      aria-label={`${sort.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}: ${fields.find(field => field.key === sort.key)?.label || 'records'}`}>
      <span aria-hidden="true">{!sort.key ? '↕' : sort.direction === 'asc' ? '↑' : '↓'}</span> {!sort.key ? 'Default order' : sort.direction === 'asc' ? 'Ascending' : 'Descending'}
    </button>
  </div>
}
