import { Link, useLocation } from "react-router-dom";
import { cx } from "../utils/cx";
import { Icon } from "./Icon";

/** Shared donor/staff links. `items`: {to,label,icon,exact?,count?,ariaLabel?,id?}. */
export function WorkspaceNav({
  items,
  onNavigate,
  linkClassName,
  children,
  className,
  ...rest
}) {
  const { pathname } = useLocation();
  return (
    <nav className={cx("workspace-nav", className)} {...rest}>
      {items.map((item) => {
        const active =
          pathname === item.to ||
          (!item.exact && pathname.startsWith(`${item.to}/`));
        return (
          <Link
            key={item.to}
            id={item.id}
            to={item.to}
            className={linkClassName}
            data-active={active ? "true" : "false"}
            aria-current={active ? "page" : undefined}
            aria-label={item.ariaLabel}
            onClick={() => onNavigate?.()}
          >
            <span className="donor-nav-icon">
              <Icon name={item.icon} size={20} />
              {item.count > 0 && (
                <span className="donor-nav-badge" aria-hidden="true">
                  {item.count > 99 ? "99+" : item.count}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
