import { useActivities } from "../context/catalogStore";
import { useState } from "react";
import type { ReactNode } from "react";
import { categories } from "../data/activities";
import type { Activity } from "../data/activities";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/navigation";
import "./Catalogue.css";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const formatDate = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("fr-BE");
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : "";

export function Catalogue({
  card,
  location,
}: {
  card: (activity: Activity) => ReactNode;
  location: string;
}) {
  const activities = useActivities();
  const cities = [...new Set(activities.map((a) => a.city))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const params = new URLSearchParams(location.split("?")[1]?.split("#")[0]);
  const query = params.get("query") || "";
  const city = cities.includes(params.get("city") || "")
    ? params.get("city")!
    : "";
  const selectedCategories = (params.get("category") || "")
    .split(",")
    .filter((c) => categories.some((item) => item.id === c));
  const price = ["free", "paid"].includes(params.get("price") || "")
    ? params.get("price")!
    : "";
  const period = params.get("period") === "weekend" ? "weekend" : "";
  const from = validDate(params.get("from") || "");
  const to = validDate(params.get("to") || "");
  const sort = ["price-asc", "price-desc"].includes(params.get("sort") || "")
    ? params.get("sort")!
    : "date";
  const invalidRange = Boolean(from && to && from > to);
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    navigate("/activites" + (next.size ? "?" + next.toString() : ""), true);
  };
  const reset = () => navigate("/activites", true);
  const toggleCategory = (id: string) =>
    update({
      category: (selectedCategories.includes(id)
        ? selectedCategories.filter((c) => c !== id)
        : [...selectedCategories, id]
      ).join(","),
    });
  const matches = activities
    .filter(
      (a) =>
        !invalidRange &&
        (!query ||
          normalize(`${a.title} ${a.description} ${a.city}`).includes(
            normalize(query),
          )) &&
        (!city || city === a.city) &&
        (!selectedCategories.length ||
          selectedCategories.includes(a.category)) &&
        (!price || (price === "free" ? a.price === 0 : a.price > 0)) &&
        (!period || a.weekend) &&
        (!from || a.startsAt.slice(0, 10) >= from) &&
        (!to || a.startsAt.slice(0, 10) <= to),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? a.price - b.price
        : sort === "price-desc"
          ? b.price - a.price
          : Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
  const pages = Math.max(1, Math.ceil(matches.length / 6));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(params.get("page") || "1") || 1),
  );
  const visible = matches.slice((page - 1) * 6, page * 6);
  const chips = [
    ...(query ? [{ label: query, remove: () => update({ query: "" }) }] : []),
    ...(city ? [{ label: city, remove: () => update({ city: "" }) }] : []),
    ...selectedCategories.map((id) => ({
      label: categories.find((c) => c.id === id)!.label,
      remove: () => toggleCategory(id),
    })),
    ...(price
      ? [
          {
            label: price === "free" ? "Gratuit" : "Payant",
            remove: () => update({ price: "" }),
          },
        ]
      : []),
    ...(period
      ? [{ label: "Le week-end", remove: () => update({ period: "" }) }]
      : []),
    ...(from
      ? [
          {
            label: `Dès le ${formatDate(from)}`,
            remove: () => update({ from: "" }),
          },
        ]
      : []),
    ...(to
      ? [
          {
            label: `Jusqu’au ${formatDate(to)}`,
            remove: () => update({ to: "" }),
          },
        ]
      : []),
  ];
  const changePage = (number: number) => {
    update({ page: String(number) });
    document
      .getElementById("catalogue-results")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="catalogue-page">
      <section className="catalogue-intro">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Fil d’Ariane">
            <a href="/">Accueil</a>
            <Icon name="chevron" />
            <span aria-current="page">Activités</span>
          </nav>
          <span className="eyebrow-pill">
            <span />
            L’agenda des découvertes locales
          </span>
          <h1 tabIndex={-1}>Toutes les activités en Belgique</h1>
          <p>
            Un atelier, une balade, une rencontre… trouvez votre prochaine
            envie.
          </p>
          <form
            key={query + "|" + city}
            className="search-bar catalogue-search"
            role="search"
            aria-label="Rechercher dans le catalogue"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              update({
                query: String(data.get("query") || "").trim(),
                city: String(data.get("city") || ""),
              });
            }}
          >
            <label className="search-field keyword">
              <Icon name="search" />
              <span>
                <span className="field-label">QUE VOULEZ-VOUS DÉCOUVRIR ?</span>
                <input
                  name="query"
                  defaultValue={query}
                  placeholder="Atelier, chocolat, randonnée…"
                  aria-label="Mot-clé"
                />
              </span>
            </label>
            <label className="search-field">
              <Icon name="pin" />
              <span>
                <span className="field-label">OÙ ?</span>
                <select name="city" defaultValue={city} aria-label="Ville">
                  <option value="">Toute la Belgique</option>
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </span>
            </label>
            <button className="button coral" type="submit">
              <Icon name="search" />
              Explorer
            </button>
          </form>
        </div>
      </section>
      <div className="container catalogue-layout">
        <button
          className="mobile-filter-toggle button outline"
          aria-expanded={filtersOpen}
          aria-controls="catalogue-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Icon name={filtersOpen ? "close" : "menu"} />
          {filtersOpen ? "Masquer les filtres" : "Afficher les filtres"}
          {chips.length > 0 && <span>{chips.length}</span>}
        </button>
        <aside
          id="catalogue-filters"
          className={`catalogue-filters ${filtersOpen ? "expanded" : ""}`}
          aria-label="Filtres des activités"
        >
          <div className="filter-heading">
            <h2>Filtres</h2>
            <button onClick={reset}>Réinitialiser</button>
          </div>
          <fieldset>
            <legend>Tarif d’accès</legend>
            <div className="price-options">
              {[
                ["", "Tous"],
                ["free", "Gratuit"],
                ["paid", "Payant"],
              ].map(([value, label]) => (
                <label key={value} className={price === value ? "checked" : ""}>
                  <input
                    type="radio"
                    name="price"
                    value={value}
                    checked={price === value}
                    onChange={() => update({ price: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Période</legend>
            <label className="check-option">
              <input
                type="checkbox"
                checked={Boolean(period)}
                onChange={(e) =>
                  update({ period: e.target.checked ? "weekend" : "" })
                }
              />
              Le week-end
            </label>
            <div className="date-fields">
              <label>
                À partir du
                <input
                  type="date"
                  aria-label="Date de début"
                  value={from}
                  onChange={(e) => update({ from: e.target.value })}
                  aria-invalid={invalidRange}
                  aria-describedby={invalidRange ? "date-error" : undefined}
                />
              </label>
              <label>
                Jusqu’au
                <input
                  type="date"
                  aria-label="Date de fin"
                  value={to}
                  onChange={(e) => update({ to: e.target.value })}
                  aria-invalid={invalidRange}
                  aria-describedby={invalidRange ? "date-error" : undefined}
                />
              </label>
            </div>
            {invalidRange && (
              <p id="date-error" role="alert" className="date-error">
                La date de fin doit suivre la date de début.
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>Catégories</legend>
            {categories.map((c) => (
              <label className="check-option" key={c.id}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                />
                <span>{c.label}</span>
                <small aria-hidden="true">
                  {activities.filter((a) => a.category === c.id).length}
                </small>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Villes de Belgique</legend>
            <label className="check-option">
              <input
                type="radio"
                name="city-filter"
                checked={!city}
                onChange={() => update({ city: "" })}
              />
              Toutes les villes
            </label>
            {cities.map((c) => (
              <label className="check-option" key={c}>
                <input
                  type="radio"
                  name="city-filter"
                  checked={city === c}
                  onChange={() => update({ city: c })}
                />
                <span>{c}</span>
                <small aria-hidden="true">
                  {activities.filter((a) => a.city === c).length}
                </small>
              </label>
            ))}
          </fieldset>
          <div className="filter-organizer">
            <Icon name="users" />
            <h3>Vous faites vivre votre quartier ?</h3>
            <p>Partagez votre passion et faites découvrir votre activité.</p>
            <a href="/#organisateurs">
              Découvrir Belconnect
              <Icon name="arrow" />
            </a>
          </div>
          <button
            className="button navy apply-mobile"
            onClick={() => {
              setFiltersOpen(false);
              document
                .getElementById("catalogue-results")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Voir les {matches.length} résultats
          </button>
        </aside>
        <section
          className="catalogue-results"
          id="catalogue-results"
          aria-label="Résultats de recherche"
        >
          <div className="results-toolbar">
            <h2 role="status">
              {matches.length} activité{matches.length > 1 ? "s" : ""} trouvée
              {matches.length > 1 ? "s" : ""}
            </h2>
            <label>
              Trier par
              <select
                aria-label="Trier les activités"
                value={sort}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="date">Date la plus proche</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
              </select>
            </label>
          </div>
          {chips.length > 0 && (
            <div className="filter-chips" aria-label="Filtres actifs">
              {chips.map((c, index) => (
                <button
                  key={c.label + index}
                  aria-label={`Retirer le filtre ${c.label}`}
                  onClick={c.remove}
                >
                  {c.label}
                  <Icon name="close" />
                </button>
              ))}
              <button className="clear-chips" onClick={reset}>
                Tout effacer
              </button>
            </div>
          )}
          <p className="catalogue-demo">
            Sélection de démonstration · Les inscriptions seront disponibles
            prochainement.
          </p>
          {visible.length ? (
            <>
              <div className="activity-grid catalogue-grid">
                {visible.map(card)}
              </div>
              <div className="catalogue-pagination">
                <p>
                  Affichage de{" "}
                  <strong>
                    {(page - 1) * 6 + 1}–{Math.min(page * 6, matches.length)}
                  </strong>{" "}
                  sur {matches.length} activités
                </p>
                {pages > 1 && (
                  <nav aria-label="Pagination du catalogue">
                    <button
                      aria-label="Page précédente"
                      disabled={page === 1}
                      onClick={() => changePage(page - 1)}
                    >
                      <Icon name="chevron" className="reverse" />
                    </button>
                    {Array.from({ length: pages }, (_, i) => (
                      <button
                        key={i}
                        aria-label={`Page ${i + 1}`}
                        aria-current={page === i + 1 ? "page" : undefined}
                        onClick={() => changePage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      aria-label="Page suivante"
                      disabled={page === pages}
                      onClick={() => changePage(page + 1)}
                    >
                      <Icon name="chevron" />
                    </button>
                  </nav>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state catalogue-empty">
              <Icon name="search" />
              <h3>
                {invalidRange
                  ? "Vérifiez les dates choisies"
                  : "Pas encore de découverte pour ces critères"}
              </h3>
              <p>
                {invalidRange
                  ? "Choisissez une date de fin égale ou postérieure à la date de début."
                  : "Essayez une autre ville ou élargissez vos filtres pour explorer la sélection."}
              </p>
              <button className="button navy" onClick={reset}>
                Réinitialiser tous les critères
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
