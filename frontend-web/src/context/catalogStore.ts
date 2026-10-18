import { createContext, useContext } from "react";
import type { Activity } from "../data/activities";
export const CatalogContext = createContext<Activity[] | null>(null);
export function useActivities() { const activities = useContext(CatalogContext); if (!activities) throw Error("Catalogue provider missing"); return activities; }
