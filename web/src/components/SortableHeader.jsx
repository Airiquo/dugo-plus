import { cx } from '../utils/cx'

/** Controlled table header; `sortKey` identifies the field, `onSort` toggles direction. */
export function SortableHeader({ sortKey, sort, onSort, children, className, ...rest }) {
  const selected = sort?.key === sortKey
  const next = selected && sort.direction === 'asc' ? 'descending' : 'ascending'
  return <th scope="col" className={cx('sortable-heading', className)} aria-sort={selected ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} {...rest}>
    <button type="button" onClick={() => onSort(sortKey)} aria-label={`Sort ${children} ${next}`}>
      {children}<span aria-hidden="true">{selected ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
    </button>
  </th>
}
