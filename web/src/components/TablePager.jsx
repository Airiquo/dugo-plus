import { cx } from '../utils/cx'

/**
 * "Showing x–y of n" pager with prev/next controls, for client-side table
 * pagination.
 *
 * @param {number} page - current page (1-based).
 * @param {number} pageCount - total number of pages (min 1).
 * @param {(page: number) => void} [onPage] - called with the target page.
 * @param {number} [rangeStart] - first visible row number.
 * @param {number} [rangeEnd] - last visible row number.
 * @param {number} total - number of rows across all pages.
 */
export function TablePager({ page, pageCount, onPage, rangeStart, rangeEnd, total, className, ...rest }) {
  return (
    <div className={cx('hospital-pager', className)} {...rest}>
      <p aria-live="polite">
        Showing{' '}
        <strong>
          {rangeStart}–{rangeEnd}
        </strong>{' '}
        of <strong>{total}</strong>
      </p>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage?.(page - 1)}
      >
        ←
      </button>
      <span>
        {page} / {pageCount}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPage?.(page + 1)}
      >
        →
      </button>
    </div>
  )
}
