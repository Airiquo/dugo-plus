import { Link } from "react-router-dom";
import { cx } from "../utils/cx";
import { Icon } from "./Icon";

/** Named summary with optional destination and semantic `tone` (attention, urgent, success). */
export function HospitalMetric({
  name,
  label,
  value,
  detail,
  icon,
  tone,
  to,
  onClick,
  className,
  ...rest
}) {
  const Tag = to ? Link : onClick ? "button" : "div";
  return (
    <Tag
      to={to}
      type={onClick && !to ? "button" : undefined}
      onClick={onClick}
      className={cx("card hw-metric", className)}
      data-tone={tone}
      {...rest}
    >
      <span className="hw-metric-heading" id={`${name}-label`}>
        {label}
        {icon && <Icon name={icon} size={18} />}
      </span>
      <strong id={`${name}-value`}>{value}</strong>
      <span className="hw-metric-detail">
        {detail}
        {(to || onClick) && <Icon name="arrow-right" size={16} />}
      </span>
    </Tag>
  );
}
