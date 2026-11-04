import { cx } from '../utils/cx'

/** Announced, theme-aware route placeholder while a page module loads. */
export function RouteSkeleton({ className, ...rest }) {
  return <div role="status" aria-live="polite" className={cx('route-skeleton', className)} {...rest}><span className="sr-only">Loading page…</span><div aria-hidden="true"><i /><i /><i /><i /></div></div>
}
