import { cx } from "../utils/cx";
import { ProfileAvatar } from "./ProfileAvatar";

/** Signed-in name and role beside the profile image; full names remain available to assistive technology. */
export function AccountIdentity({ name, role, photoURL, className, ...rest }) {
  return (
    <span className={cx("account-identity", className)} {...rest}>
      <ProfileAvatar src={photoURL} name={name} />
      <span className="account-identity-copy">
        <strong title={name}>{name}</strong>
        <small>{role}</small>
      </span>
    </span>
  );
}
