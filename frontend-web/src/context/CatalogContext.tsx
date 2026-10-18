import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Activity } from "../data/activities";
import { categories } from "../data/activities";

import { CatalogContext } from "./catalogStore";
const dateFormat = new Intl.DateTimeFormat("fr-BE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Brussels",
});
const timeFormat = new Intl.DateTimeFormat("fr-BE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Brussels",
});
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function parseActivity(value: unknown): Activity {
  if (!isRecord(value) || !isRecord(value.details))
    throw Error("Réponse du catalogue invalide.");
  const details = value.details;
  for (const key of [
    "id",
    "title",
    "category",
    "city",
    "location",
    "host",
    "image",
    "startsAt",
    "description",
  ])
    if (typeof value[key] !== "string") throw Error("Activité incomplète.");
  for (const key of ["duration", "audience", "meetingPoint", "preparation"])
    if (typeof details[key] !== "string") throw Error("Détails incomplets.");
  if (
    !categories.some((c) => c.id === value.category) ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.id as string) ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.image as string) ||
    typeof value.price !== "number" ||
    !Number.isFinite(value.price) ||
    value.price < 0 ||
    typeof value.demonstration !== "boolean" ||
    !Number.isInteger(details.capacity) ||
    !Number.isInteger(details.remaining) ||
    (details.capacity as number) < 1 ||
    (details.remaining as number) < 0 ||
    (details.remaining as number) > (details.capacity as number) ||
    !["program", "included"].every(
      (key) =>
        Array.isArray(details[key]) &&
        (details[key] as unknown[]).every((item) => typeof item === "string"),
    )
  )
    throw Error("Données du catalogue invalides.");
  const startsAt = new Date(value.startsAt as string);
  if (Number.isNaN(startsAt.getTime())) throw Error("Date invalide.");
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Brussels",
  }).format(startsAt);
  return {
    ...value,
    badge: typeof value.badge === "string" ? value.badge : undefined,
    date: `${dateFormat.format(startsAt)} · ${timeFormat.format(startsAt)}`,
    weekend: weekday === "Sat" || weekday === "Sun",
  } as Activity;
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch("/api/activities", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw Error("Catalogue indisponible");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw Error("Réponse invalide");
        return data.map(parseActivity);
      })
      .then((data) => {
        if (active) setActivities(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);
  useEffect(() => {
    const refresh = () => setAttempt(v => v + 1);
    const reset = () => { setActivities([]); refresh(); };
    window.addEventListener("catalog-refresh", refresh);
    window.addEventListener("catalog-reset", reset);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("catalog-refresh", refresh); window.removeEventListener("catalog-reset", reset); window.removeEventListener("focus", refresh); };
  }, []);
  if (!activities)
    return (
      <main className="catalog-service-state">
        <a className="brand" href="/">
          Bel<span>connect</span>
        </a>
        <div role={error ? "alert" : "status"}>
          <h1>
            {error
              ? "Les activités sont momentanément indisponibles"
              : "Vos prochaines découvertes arrivent…"}
          </h1>
          <p>
            {error
              ? "Impossible de charger le catalogue. Vérifiez que le serveur Belconnect est démarré, puis réessayez."
              : "Chargement du catalogue Belconnect."}
          </p>
          {error && (
            <button
              className="button navy"
              onClick={() => {
                setError(false);
                setAttempt((v) => v + 1);
              }}
            >
              Réessayer
            </button>
          )}
        </div>
      </main>
    );
  return (
    <CatalogContext.Provider value={activities}>
      {children}
    </CatalogContext.Provider>
  );
}
