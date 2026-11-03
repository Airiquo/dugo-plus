import { cx } from "../utils/cx";

/** Hospital page title, description and contextual actions. `eyebrow` labels the workflow. */
export function HospitalPageHeader({
  title,
  description,
  eyebrow = "Hospital workspace",
  actions,
  className,
  ...rest
}) {
  return (
    <header className={cx("hw-page-header", className)} {...rest}>
      <div>
        <p className="hw-eyebrow">{eyebrow}</p>
        <h1 id="page-title">{title}</h1>
        {description && <p className="hw-page-description">{description}</p>}
      </div>
      {actions && <div className="hw-page-actions">{actions}</div>}
    </header>
  );
}
