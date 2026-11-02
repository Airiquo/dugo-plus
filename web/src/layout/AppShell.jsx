import { RoleShell } from "./RoleShell";
export const NAV = [
  {
    slug: "dashboard",
    screen: "admin-dashboard",
    label: "Dashboard",
    icon: "grid",
  },
  {
    slug: "blood-requests",
    screen: "admin-blood-requests",
    label: "Blood Requests",
    icon: "list",
    badge: { id: "nav-urgent-count", status: "urgent", text: "3" },
  },
  {
    slug: "donor-matching",
    screen: "admin-donor-matching",
    label: "Donor Matching",
    icon: "target",
  },
  {
    slug: "donor-registry",
    screen: "admin-donor-registry",
    label: "Donor Registry",
    icon: "user",
  },
  {
    slug: "accounts",
    screen: "admin-accounts",
    label: "Accounts",
    icon: "user",
  },
  {
    slug: "inventory",
    screen: "admin-inventory",
    label: "Inventory",
    icon: "box",
  },
  {
    slug: "donations-rewards",
    screen: "admin-donations-rewards",
    label: "Donations",
    icon: "gift",
  },
  { slug: "reports", screen: "admin-reports", label: "Reports", icon: "chart" },
  {
    slug: "audit-trail",
    screen: "admin-audit-trail",
    label: "Audit Trail",
    icon: "file",
  },
  {
    slug: "data-requests",
    screen: "admin-data-requests",
    label: "Data Requests",
    icon: "download",
  },
  {
    slug: "settings",
    screen: "admin-settings",
    label: "Settings",
    icon: "settings",
  },
  {
    slug: "profile",
    screen: "admin-profile",
    label: "Profile",
    icon: "user",
  },
];
/** Admin sidebar and compact mobile workspace navigation. */
export function AppShell({ children, ...rest }) {
  const items = NAV.filter((item) =>
    [
      "dashboard",
      "accounts",
      "audit-trail",
      "data-requests",
      "settings",
      "profile",
    ].includes(item.slug),
  ).map((item) => ({
    to: `/admin/${item.slug}`,
    label: item.label,
    icon: item.icon,
    id: `nav-${item.slug}`,
    exact: true,
  }));
  return (
    <RoleShell area="admin" items={items} {...rest}>
      {children}
    </RoleShell>
  );
}
