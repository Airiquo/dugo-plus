import { cx } from "../utils/cx";
import { Icon } from "./Icon";

/** Inline feedback. `tone`: neutral, attention, error or success; errors announce immediately. */
export function HospitalNotice({
  title,
  children,
  tone = "neutral",
  className,
  ...rest
}) {
  return (
    <div
      className={cx("hw-notice", className)}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      {...rest}
    >
      <Icon
        name={
          tone === "error" || tone === "attention"
            ? "alert"
            : tone === "success"
              ? "check"
              : "shield"
        }
        size={19}
      />
      <div>
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
