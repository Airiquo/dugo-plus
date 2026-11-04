import { RoleShell } from "./RoleShell";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

let rememberedFacility = { account: "", name: "" };
export const HOSPITAL_NAV = [
  { slug: "dashboard", label: "Overview", icon: "grid" },
  { slug: "requests", label: "Blood requests", icon: "request" },
  { slug: "inventory", label: "Inventory", icon: "box" },
  { slug: "inventory-log", label: "Donation & stock history", icon: "list" },
  { slug: "map", label: "Hospital map", icon: "map" },
  { slug: "profile", label: "My profile", icon: "user" },
  { slug: "settings", label: "Settings", icon: "settings" },
];
/** Hospital chrome retains the account's resolved facility name between route loads. */
export function HospitalShell({ children, facility, ...rest }) {
  const { user, profile } = useAuth();
  const account = `${user?.uid || ""}:${profile?.hospitalId || ""}`;
  const resolved =
    facility?.trim() ||
    (rememberedFacility.account === account ? rememberedFacility.name : "");
  useEffect(() => {
    if (facility?.trim())
      rememberedFacility = { account, name: facility.trim() };
  }, [account, facility]);
  const items = HOSPITAL_NAV.map((item) => ({
    to: `/hospital/${item.slug}`,
    label: item.label,
    icon: item.icon,
    ariaLabel:
      item.slug === "inventory-log" ? "Donation and stock history" : undefined,
    id: `nav-${item.slug}`,
  }));
  return (
    <RoleShell area="hospital" items={items} facility={resolved} {...rest}>
      <div className="hospital-workspace">{children}</div>
    </RoleShell>
  );
}
