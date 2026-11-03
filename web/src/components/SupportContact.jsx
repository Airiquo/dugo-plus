import { cx } from '../utils/cx'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../utils/support'

/** Shared help contact using the owner's support mailbox. */
export function SupportContact({ className, ...rest }) {
  return <p className={cx('support-contact', className)} {...rest}>Any questions? Contact us at{' '}<a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.</p>
}
