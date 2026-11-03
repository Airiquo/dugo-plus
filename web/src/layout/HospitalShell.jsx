import { RoleShell } from "./RoleShell";
export const HOSPITAL_NAV = [
  { slug: "dashboard", label: "Dashboard", icon: "grid" },
  { slug: "inventory", label: "Inventory", icon: "box" },
  { slug: "inventory-log", label: "Inventory log", icon: "list" },
  { slug: "map", label: "Hospital map", icon: "map" },
  { slug: "facility", label: "Facility details", icon: "settings" },
  { slug: "requests", label: "Requests", icon: "list" },
  { slug: "profile", label: "My profile", icon: "user" },
];
/** Hospital chrome; `facility` is shown when its linked record loads. */
export function HospitalShell({ children, facility, ...rest }) {
  const items = HOSPITAL_NAV.map((item) => ({
    to: `/hospital/${item.slug}`,
    label: item.label,
    icon: item.icon,
    id: `nav-${item.slug}`,
  }));
  return (
    <RoleShell area="hospital" items={items} facility={facility} {...rest}>
      {children}
    </RoleShell>
  );
}
