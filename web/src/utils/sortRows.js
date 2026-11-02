const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const missing = value => value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value))

/** Stable ordering; missing values remain last in both directions. */
export function sortRows(rows, valueFor, direction = 'asc') {
  if (!valueFor) return rows
  return rows.map((row, index) => ({ row, index, value: valueFor(row) })).sort((a, b) => {
    if (missing(a.value) || missing(b.value)) return missing(a.value) === missing(b.value) ? a.index - b.index : missing(a.value) ? 1 : -1
    const comparison = typeof a.value === 'number' && typeof b.value === 'number'
      ? a.value - b.value : collator.compare(String(a.value), String(b.value))
    return comparison * (direction === 'desc' ? -1 : 1) || a.index - b.index
  }).map(item => item.row)
}

export function sortDate(value) {
  if (value === null || value === undefined || value === '') return null
  const date = value.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}
