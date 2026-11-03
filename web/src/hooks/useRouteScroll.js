import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Begin newly selected donor/staff workspaces at the top of the document. */
export function useRouteScroll() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
}
