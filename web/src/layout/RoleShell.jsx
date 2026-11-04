import { SupportContact } from "../components/SupportContact";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Icon,
  NavigationSheet,
  AccountMenu,
  WorkspaceNav,
} from "../components";
import { useAuth, userName } from "../hooks/useAuth";
import { roleLabel } from "../services/users";
import { useRouteScroll } from "../hooks/useRouteScroll";
import { cx } from "../utils/cx";

/** Staff chrome; `area` selects navigation only. Route guards retain authorization. */
export function RoleShell({
  area,
  items,
  facility,
  children,
  className,
  ...rest
}) {
  const { user, profile, role } = useAuth();
  const { pathname } = useLocation();
  useRouteScroll();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = profile?.fullName || userName(user);
  const profileTo = `/${area}/settings`;
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const mobileItems = items.map(({ id, ...item }) => item);
  const primary =
    area === "admin"
      ? mobileItems
          .filter((item) =>
            [
              "/admin/dashboard",
              "/admin/accounts",
              "/admin/audit-trail",
            ].includes(item.to),
          )
          .map((item) => ({
            ...item,
            label: item.to.endsWith("dashboard")
              ? "Overview"
              : item.to.endsWith("audit-trail")
                ? "Activity"
                : item.label,
          }))
      : [
          {
            to: "/hospital/dashboard",
            label: "Overview",
            icon: "grid",
            exact: true,
          },
          {
            to: "/hospital/requests",
            label: "Requests",
            icon: "request",
            exact: false,
          },
          {
            to: "/hospital/inventory",
            label: "Inventory",
            icon: "box",
            exact: true,
          },
        ];
  const moreActive = !primary.some(
    (item) =>
      pathname === item.to ||
      (!item.exact && pathname.startsWith(`${item.to}/`)),
  );
  return (
    <div
      id="app-shell"
      className={cx("role-shell", className)}
      data-area={area}
      {...rest}
    >
      <a className="care-skip-link" href="#page-content">
        Skip to content
      </a>
      <aside id="sidebar">
        <div id="sidebar-logo">
          <Link to="/" id="sidebar-logo-name">
            <span className="app-mark" aria-hidden="true" />
            dugo<span className="plus">+</span>
          </Link>
          {(facility || area === "admin" || area === "hospital") && (
            <span
              id="sidebar-logo-facility"
              className="workspace-facility-name"
              title={facility || undefined}
            >
              {area === "hospital"
                ? facility || (
                    <span
                      className="workspace-name-loading"
                      aria-label="Loading hospital name"
                    />
                  )
                : "Administration"}
            </span>
          )}
        </div>
        <div id="sidebar-section-label">{roleLabel(role)}</div>
        <WorkspaceNav
          id="sidebar-nav"
          items={items}
          aria-label={
            area === "admin"
              ? "Administration navigation"
              : "Hospital navigation"
          }
          linkClassName="btn"
        />
        <div id="sidebar-signed-in">
          <AccountMenu name={name} photoURL={profile?.photoURL} accountRole={area === "hospital" ? "Hospital staff" : "Administrator"} settingsTo={profileTo} placement="side" />

        </div>
      </aside>
      <header className="staff-mobile-header">
        <Link to="/" className="staff-mobile-brand" aria-label="Dugo+ home">
          <span className="app-mark" aria-hidden="true" />
          <span>
            dugo<b>+</b>
            <small>
              {area === "admin"
                ? "Administration"
                : facility || (
                    <span
                      className="workspace-name-loading"
                      aria-label="Loading hospital name"
                    />
                  )}
            </small>
          </span>
        </Link>
        <div className="staff-mobile-actions">
          <AccountMenu name={name} photoURL={profile?.photoURL} accountRole={area === "hospital" ? "Hospital staff" : "Administrator"} settingsTo={profileTo} />

        </div>
      </header>
      <main id="page-content" tabIndex={-1}>
        {children}
        <SupportContact as="footer" />
      </main>
      <WorkspaceNav
        className="staff-bottom-nav"
        items={primary}
        aria-label={
          area === "admin"
            ? "Admin mobile navigation"
            : "Hospital mobile navigation"
        }
      >
        {mobileItems.some(
          (item) => !primary.some((link) => link.to === item.to),
        ) && (
          <button
            type="button"
            data-active={moreActive ? "true" : "false"}
            aria-expanded={menuOpen}
            aria-controls={`${area}-navigation-modal`}
            onClick={() => setMenuOpen(true)}
          >
            <span className="donor-nav-icon">
              <Icon name="menu" size={20} />
            </span>
            <span>More</span>
          </button>
        )}
      </WorkspaceNav>
      <NavigationSheet
        name={`${area}-navigation`}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={mobileItems}
      />
      <div id="overlay-root" />
      <div id="toast-root" />
    </div>
  );
}
