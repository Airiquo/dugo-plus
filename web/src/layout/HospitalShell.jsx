import { RoleShell } from "./RoleShell";
export const HOSPITAL_NAV = [
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
