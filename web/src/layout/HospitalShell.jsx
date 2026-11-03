import { RoleShell } from "./RoleShell";
export const HOSPITAL_NAV = [
  { slug: "dashboard", label: "Overview", icon: "grid" },
  { slug: "requests", label: "Blood requests", icon: "droplet" },
  { slug: "inventory", label: "Inventory", icon: "box" },
  { slug: "inventory-log", label: "Donation & stock history", icon: "list" },
  { slug: "map", label: "Hospital map", icon: "map" },
  { slug: "facility", label: "Facility details", icon: "settings" },
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
      <div className="hospital-workspace">{children}</div>
    </RoleShell>
  );
}
