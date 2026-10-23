import { useSyncExternalStore } from "react";
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
};
const snapshot = () =>
  window.location.pathname + window.location.search + window.location.hash;
export function useLocation() {
  return useSyncExternalStore(subscribe, snapshot);
}
export function navigate(url: string, replace = false) {
  if (url === snapshot()) return;
  if (window.location.pathname === "/mon-espace" && url.startsWith("/mon-espace") && !replace) {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function catalogueUrl(values: Record<string, string> = {}) {
  const params = new URLSearchParams(
    Object.entries(values).filter(([, value]) => value),
  );
  return "/activites" + (params.size ? "?" + params.toString() : "");
}
