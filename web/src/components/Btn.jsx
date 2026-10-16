import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { cx } from './types'
function btnClass(variant = 'default', className) {
  return cx('btn', variant === 'ghost' && 'tx', className)
}
function btnAttrs(variant = 'default') {
  if (variant === 'primary') return { 'data-primary': true }
  if (variant === 'alert') return { 'data-status': 'emergency' }
  return {}
}
export function Btn({ variant, icon, children, className, type = 'button', ...rest }) {
  return (
    <button type={type} className={btnClass(variant, className)} {...btnAttrs(variant)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}
/** Router link that looks like a button. */
export function LinkBtn({ variant, icon, children, className, ...rest }) {
  return (
    <Link className={btnClass(variant, className)} {...btnAttrs(variant)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  )
}
