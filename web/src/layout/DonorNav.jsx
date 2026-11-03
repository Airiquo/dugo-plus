import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PubThemeToggle,
  AccountIdentity,
  WorkspaceNav,
  Icon,
} from "../components";
import { useRouteScroll } from "../hooks/useRouteScroll";
import { useAuth, userName } from "../hooks/useAuth";
import { listenDonorAlerts } from "../services/alerts";

export const DONOR_NAV = [
  { to: "/home", label: "My profile", icon: "user" },
  { to: "/donor/requests", label: "Requests", icon: "request" },
  { to: "/donor/activity", label: "Activity", icon: "chart" },
  { to: "/donor/alerts", label: "Alerts", icon: "bell" },
  { to: "/donor/privacy", label: "Privacy", icon: "settings" },
];

/** Donor navigation becomes a bottom bar on small screens. */
export function DonorNav() {
  useRouteScroll();
  const { user, profile, signOut } = useAuth();
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
          <PubThemeToggle />
          <Link
            className="donor-account-link"
            to="/home"
            aria-label={`Your profile, ${name}`}
          >
            <AccountIdentity
              photoURL={profile?.photoURL}
              name={name}
              role="Donor"
            />
          </Link>
          <button
            className="care-signout"
            type="button"
            onClick={signOut}
            aria-label="Sign out"
          >
            <Icon name="logout" size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </header>
    </>
  );
}
