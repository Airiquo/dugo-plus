import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Begin newly selected donor/staff workspaces at the top of the document. */
export function useRouteScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
}
