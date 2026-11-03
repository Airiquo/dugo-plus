import { cx } from "../utils/cx";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "../utils/support";

/** Shared help contact; `as="footer"` marks the end of a signed-in workspace. */
export function SupportContact({ as: Tag = "p", className, ...rest }) {
  return (
    <Tag className={cx("support-contact", className)} {...rest}>
      Any questions? Contact us at <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
    </Tag>
  );
}
