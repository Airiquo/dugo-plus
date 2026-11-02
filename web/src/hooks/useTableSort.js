import { useState } from 'react'

/** Null key preserves the screen's existing default order. */
export function useTableSort() {
  const [sort, setSort] = useState({ key: null, direction: 'asc' })
  const toggleSort = key => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
  return { sort, toggleSort, setSort }
}
