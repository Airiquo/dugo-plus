import { cx } from '../utils/cx'
import { Icon } from './Icon'

/**
 * The message shown under a form field that failed validation.
 *
 * Rendered only when there is something to say, so screens can place it
 * unconditionally: `{errors.email ? <FieldError id="login-email-error">{errors.email}</FieldError> : null}`
 * is not needed.
 *
 * `id` is what the input's `aria-describedby` points at, and the element is
 * `role="alert"` so a failure is announced rather than only seen.
 *
 * `showIcon` (default true) drops the leading glyph for a quieter inline note.
 */
export function FieldError({ id, showIcon = true, className, children, ...rest }) {
  if (!children) return null
  return (
    <p id={id} className={cx('field-error', className)} role="alert" {...rest}>
      {showIcon && <Icon name="alert" size={13} />}
      <span>{children}</span>
    </p>
  )
}
