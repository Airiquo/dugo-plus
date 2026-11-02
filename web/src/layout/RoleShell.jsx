import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Icon,
  NavigationSheet,
  ProfileAvatar,
  WorkspaceNav,
} from "../components";
import { useTheme } from "../hooks/useTheme";
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
  const { user, profile, role, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  useRouteScroll();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const name = profile?.fullName || userName(user);
  const profileTo = `/${area}/profile`;
  const next = theme === "light" ? "dark" : "light";
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
  async function leave() {
    if (leaving) return;
    setLeaving(true);
    setError("");
    try {
      await signOut();
      navigate("/");
    } catch {
      setError("Sign out failed. Please try again.");
      setLeaving(false);
    }
  }
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
            to: "/hospital/requests",
            label: "Requests",
            icon: "list",
            exact: true,
          },
          {
            to: "/hospital/requests/new",
            label: "New request",
            icon: "plus",
            exact: true,
          },
          { to: profileTo, label: "My profile", icon: "user", exact: true },
        ];
  const moreActive = !primary.some((item) => item.to === pathname);
  const themeButton = (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon name={theme === "light" ? "moon" : "sun"} size={19} />
    </button>
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
          {(facility || area === "admin") && (
            <span id="sidebar-logo-facility" className="pill">
              {facility || "Account management"}
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
          <Link
            className="sidebar-profile-link"
            to={profileTo}
            aria-label={`Your profile, ${name}`}
          >
            <ProfileAvatar src={profile?.photoURL} name={name} />
            <span>Signed in as {name}</span>
          </Link>
          <div className="role-session-actions">
            {themeButton}
            <button
              id="sidebar-sign-out"
              type="button"
              onClick={leave}
              disabled={leaving}
            >
              {leaving ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>
      <header className="staff-mobile-header">
        <Link to="/" className="staff-mobile-brand" aria-label="Dugo+ home">
          <span className="app-mark" aria-hidden="true" />
          <span>
            dugo<b>+</b>
            <small>
              {area === "admin" ? "Admin workspace" : "Hospital workspace"}
            </small>
          </span>
        </Link>
        <div className="staff-mobile-actions">
          {themeButton}
          <Link
            className="staff-mobile-avatar"
            to={profileTo}
            aria-label={`Your profile, ${name}`}
          >
            <ProfileAvatar src={profile?.photoURL} name={name} />
          </Link>
          <button
            type="button"
            className="btn"
            aria-label="Sign out"
            title="Sign out"
            disabled={leaving}
            onClick={leave}
          >
            <Icon name="logout" size={19} />
          </button>
        </div>
      </header>
      <main id="page-content" tabIndex={-1}>
        {error && (
          <p className="role-session-error" role="alert">
            {error}
          </p>
        )}
        {children}
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
        {area === "admin" && (
          <button
            type="button"
            data-active={moreActive ? "true" : "false"}
            aria-expanded={menuOpen}
            aria-controls="admin-navigation-modal"
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
