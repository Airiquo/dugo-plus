import { cx } from '../utils/cx'
import { Icon } from './Icon'
/**
 * Toasts. `#toast-root` is rendered once by <AppShell>; push <Toast> items into
 * it (or render a local stack in the gallery).
 */
export function ToastStack({ children }) {
  return <div id="toast-root">{children}</div>
}
export function Toast({ children, icon, className, ...rest }) {
  return (
    <div className={cx('toast', className)} role="status" {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </div>
  )
}
