import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AccountMenu,
  WorkspaceNav,
} from "../components";
import { useRouteScroll } from "../hooks/useRouteScroll";
import { useAuth, userName } from "../hooks/useAuth";
import { listenDonorAlerts } from "../services/alerts";

export const DONOR_NAV = [
  { to: "/donor/settings", label: "Settings", icon: "settings" },
  { to: "/donor/requests", label: "Requests", icon: "request" },
  { to: "/donor/activity", label: "Activity", icon: "chart" },
  { to: "/donor/alerts", label: "Alerts", icon: "bell" },
  { to: "/donor/privacy", label: "Privacy", icon: "shield" },
];

/** Donor navigation becomes a bottom bar on small screens. */
export function DonorNav() {
  useRouteScroll();
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const name = profile?.fullName?.trim() || userName(user);

  useEffect(() => {
    setUnreadCount(0);
    if (!user?.uid) return;
    return listenDonorAlerts(
      user.uid,
      (items) => setUnreadCount(items.filter((item) => !item.readAt).length),
      () => setUnreadCount(0),
    );
  }, [user?.uid]);

  return (
    <>
      <a className="care-skip-link" href="#top">
        Skip to content
      </a>
      <header className="pub-nav donor-nav">
        <Link className="pub-logo" to="/" aria-label="Dugo+ home">
          <span className="pub-mark" aria-hidden="true" />
          <span className="pub-word">
            dugo<span>+</span>
          </span>
        </Link>
        <WorkspaceNav
          aria-label="Donor navigation"
          items={DONOR_NAV.map((item) => ({
            ...item,
            exact: true,
            count: item.label === "Alerts" ? unreadCount : 0,
            ariaLabel:
              item.label === "Alerts"
                ? `Alerts${unreadCount > 0 ? `, ${unreadCount} unread notifications` : ""}`
                : undefined,
          }))}
        />

        <div className="pub-nav-end">
          <AccountMenu name={name} photoURL={profile?.photoURL} accountRole="Donor" settingsTo="/donor/settings" />

        </div>
      </header>
    </>
  );
}
