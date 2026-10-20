import { cx } from '../utils/cx'
function statusClass(cls, className) {
  return cx(cls, className)
}
export function Chip({ className, children, ...rest }) {
  return (
    <span className={statusClass('chip', className)} {...rest}>
      {children}
    </span>
  )
}
export function Badge({ className, children, ...rest }) {
  return (
    <span className={statusClass('badge', className)} {...rest}>
      {children}
    </span>
  )
}
export function Pill({ className, children, ...rest }) {
  return (
    <span className={statusClass('pill', className)} {...rest}>
      {children}
    </span>
  )
}
