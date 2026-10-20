import { createContext, useContext } from "react";
import type { Activity } from "../data/activities";
type CatalogState = { activities: Activity[]; loaded: boolean; loading: boolean; error: boolean; partial: boolean; retry: () => void };
export const CatalogContext = createContext<CatalogState | null>(null);
export function useCatalog() {
  const state = useContext(CatalogContext);
  if (!state) throw Error("Catalogue provider missing");
  return state;
}
export function useActivities() { return useCatalog().activities; }
