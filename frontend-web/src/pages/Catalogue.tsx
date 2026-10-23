import { useActivities } from "../context/catalogStore";
import { useState } from "react";
import type { ReactNode } from "react";
import { categories } from "../data/activities";
import type { Activity } from "../data/activities";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/navigation";
import { tr, useLocale } from '../lib/locale';
import "./Catalogue.css";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const formatDate = (value: string, locale: string) =>
  new Date(value + "T12:00:00").toLocaleDateString(locale === 'nl' ? 'nl-BE' : locale === 'en' ? 'en-BE' : 'fr-BE');
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
  const locale = useLocale();
  const t = (fr: string, en: string, nl: string) => tr(locale, fr, en, nl);
  const categoryLabel = (id: string) => {
    const labels: Record<string, [string, string, string]> = {
      art: ['Art & Céramique', 'Art & Ceramics', 'Kunst & Keramiek'],
      gastronomie: ['Gastronomie', 'Food & Drink', 'Gastronomie'],
      nature: ['Plein air & Nature', 'Outdoors & Nature', 'Buiten & Natuur'],
      culture: ['Culture & Spectacles', 'Culture & Shows', 'Cultuur & Voorstellingen'],
      'savoir-faire': ['Savoir-faire', 'Crafts & Skills', 'Ambacht & Vaardigheden'],
      'bien-etre': ['Bien-être', 'Wellbeing', 'Welzijn'],
    };
    return labels[id] ? t(...labels[id]) : id;
  };
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
      label: categoryLabel(id),
      remove: () => toggleCategory(id),
    })),
    ...(price
      ? [
          {
            label: price === "free" ? t("Gratuit", "Free", "Gratis") : t("Payant", "Paid", "Betalend"),
            remove: () => update({ price: "" }),
          },
        ]
      : []),
    ...(period
      ? [{ label: t("Le week-end", "Weekend", "Weekend"), remove: () => update({ period: "" }) }]
      : []),
    ...(from
      ? [
          {
            label: `${t('Dès le', 'From', 'Vanaf')} ${formatDate(from, locale)}`,
            remove: () => update({ from: "" }),
          },
        ]
      : []),
    ...(to
      ? [
          {
            label: `${t('Jusqu’au', 'Until', 'Tot')} ${formatDate(to, locale)}`,
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
            <a href="/">{t('Accueil', 'Home', 'Start')}</a>
            <Icon name="chevron" />
            <span aria-current="page">{t('Activités', 'Activities', 'Activiteiten')}</span>
          </nav>
          <span className="eyebrow-pill">
            <span />
            {t('L’agenda des découvertes locales', 'Your guide to local discoveries', 'De agenda voor lokale ontdekkingen')}
          </span>
          <h1 tabIndex={-1}>{t('Toutes les activités en Belgique', 'All activities in Belgium', 'Alle activiteiten in België')}</h1>
          <p>
            {t('Un atelier, une balade, une rencontre… trouvez votre prochaine envie.', 'A workshop, a walk, a gathering… find your next experience.', 'Een workshop, wandeling of ontmoeting… ontdek uw volgende activiteit.')}
          </p>
          <form
            key={query + "|" + city}
            className="search-bar catalogue-search"
            role="search"
            aria-label={t('Rechercher dans le catalogue', 'Search the catalogue', 'Zoeken in de catalogus')}
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
                <span className="field-label">{t('QUE VOULEZ-VOUS DÉCOUVRIR ?', 'WHAT WOULD YOU LIKE TO DISCOVER?', 'WAT WILT U ONTDEKKEN?')}</span>
                <input
                  name="query"
                  defaultValue={query}
                  placeholder={t('Atelier, chocolat, randonnée…', 'Workshop, chocolate, hiking…', 'Workshop, chocolade, wandelen…')}
                  aria-label={t('Mot-clé', 'Keyword', 'Zoekwoord')}
                />
              </span>
            </label>
            <label className="search-field">
              <Icon name="pin" />
              <span>
                <span className="field-label">{t('OÙ ?', 'WHERE?', 'WAAR?')}</span>
                <select name="city" defaultValue={city} aria-label={t('Ville', 'City', 'Stad')}>
                  <option value="">{t('Toute la Belgique', 'All of Belgium', 'Heel België')}</option>
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </span>
            </label>
            <button className="button coral" type="submit">
              <Icon name="search" />
              {t('Explorer', 'Explore', 'Ontdekken')}
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
          {filtersOpen ? t('Masquer les filtres', 'Hide filters', 'Filters verbergen') : t('Afficher les filtres', 'Show filters', 'Filters tonen')}
          {chips.length > 0 && <span>{chips.length}</span>}
        </button>
        <aside
          id="catalogue-filters"
          className={`catalogue-filters ${filtersOpen ? "expanded" : ""}`}
          aria-label={t('Filtres des activités', 'Activity filters', 'Activiteitenfilters')}
        >
          <div className="filter-heading">
            <h2>{t('Filtres', 'Filters', 'Filters')}</h2>
            <button onClick={reset}>{t('Réinitialiser', 'Reset', 'Herstellen')}</button>
          </div>
          <fieldset>
            <legend>{t('Tarif d’accès', 'Price', 'Prijs')}</legend>
            <div className="price-options">
              {[
                ["", t('Tous', 'All', 'Alle')],
                ["free", t('Gratuit', 'Free', 'Gratis')],
                ["paid", t('Payant', 'Paid', 'Betalend')],
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
            <legend>{t('Période', 'Period', 'Periode')}</legend>
            <label className="check-option">
              <input
                type="checkbox"
                checked={Boolean(period)}
                onChange={(e) =>
                  update({ period: e.target.checked ? "weekend" : "" })
                }
              />
              {t('Le week-end', 'Weekend', 'Weekend')}
            </label>
            <div className="date-fields">
              <label>
                {t('À partir du', 'From', 'Vanaf')}
                <input
                  type="date"
                  aria-label={t('Date de début', 'Start date', 'Begindatum')}
                  value={from}
                  onChange={(e) => update({ from: e.target.value })}
                  aria-invalid={invalidRange}
                  aria-describedby={invalidRange ? "date-error" : undefined}
                />
              </label>
              <label>
                {t('Jusqu’au', 'Until', 'Tot')}
                <input
                  type="date"
                  aria-label={t('Date de fin', 'End date', 'Einddatum')}
                  value={to}
                  onChange={(e) => update({ to: e.target.value })}
                  aria-invalid={invalidRange}
                  aria-describedby={invalidRange ? "date-error" : undefined}
                />
              </label>
            </div>
            {invalidRange && (
              <p id="date-error" role="alert" className="date-error">
                {t('La date de fin doit suivre la date de début.', 'The end date must be after the start date.', 'De einddatum moet na de begindatum vallen.')}
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>{t('Catégories', 'Categories', 'Categorieën')}</legend>
            {categories.map((c) => (
              <label className="check-option" key={c.id}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                />
                <span>{categoryLabel(c.id)}</span>
                <small aria-hidden="true">
                  {activities.filter((a) => a.category === c.id).length}
                </small>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t('Villes de Belgique', 'Belgian cities', 'Belgische steden')}</legend>
            <label className="check-option">
              <input
                type="radio"
                name="city-filter"
                checked={!city}
                onChange={() => update({ city: "" })}
              />
              {t('Toutes les villes', 'All cities', 'Alle steden')}
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
            <h3>{t('Vous faites vivre votre quartier ?', 'Bringing your neighbourhood to life?', 'Brengt u uw buurt tot leven?')}</h3>
            <p>{t('Partagez votre passion et faites découvrir votre activité.', 'Share your passion and introduce others to your activity.', 'Deel uw passie en laat anderen uw activiteit ontdekken.')}</p>
            <a href="/#organisateurs">
              {t('Découvrir Belconnect', 'Discover Belconnect', 'Ontdek Belconnect')}
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
            {t('Voir les', 'Show', 'Bekijk')} {matches.length} {t('résultats', 'results', 'resultaten')}
          </button>
        </aside>
        <section
          className="catalogue-results"
          id="catalogue-results"
          aria-label={t('Résultats de recherche', 'Search results', 'Zoekresultaten')}
        >
          <div className="results-toolbar">
            <h2 role="status">
              {matches.length} {t(matches.length > 1 ? 'activités trouvées' : 'activité trouvée', matches.length > 1 ? 'activities found' : 'activity found', matches.length > 1 ? 'activiteiten gevonden' : 'activiteit gevonden')}
            </h2>
            <label>
              {t('Trier par', 'Sort by', 'Sorteren op')}
              <select
                aria-label={t('Trier les activités', 'Sort activities', 'Activiteiten sorteren')}
                value={sort}
                onChange={(e) => update({ sort: e.target.value })}
              >
                <option value="date">{t('Date la plus proche', 'Soonest date', 'Eerstvolgende datum')}</option>
                <option value="price-asc">{t('Prix croissant', 'Lowest price', 'Laagste prijs')}</option>
                <option value="price-desc">{t('Prix décroissant', 'Highest price', 'Hoogste prijs')}</option>
              </select>
            </label>
          </div>
          {chips.length > 0 && (
            <div className="filter-chips" aria-label={t('Filtres actifs', 'Active filters', 'Actieve filters')}>
              {chips.map((c, index) => (
                <button
                  key={c.label + index}
                  aria-label={`${t('Retirer le filtre', 'Remove filter', 'Filter verwijderen')} ${c.label}`}
                  onClick={c.remove}
                >
                  {c.label}
                  <Icon name="close" />
                </button>
              ))}
              <button className="clear-chips" onClick={reset}>
                {t('Tout effacer', 'Clear all', 'Alles wissen')}
              </button>
            </div>
          )}
          <p className="catalogue-demo">
            {t('Certaines activités sont des exemples ; leur fiche précise si le paiement est simulé. Les inscriptions gratuites sont enregistrées dans votre compte.', 'Some activities are examples; their pages indicate whether payment is simulated. Free registrations are saved to your account.', 'Sommige activiteiten zijn voorbeelden; op hun pagina staat of de betaling gesimuleerd wordt. Gratis inschrijvingen worden in uw account opgeslagen.')}
          </p>
          {visible.length ? (
            <>
              <div className="activity-grid catalogue-grid">
                {visible.map(card)}
              </div>
              <div className="catalogue-pagination">
                <p>
                  {t('Affichage de', 'Showing', 'Weergave van')}{" "}
                  <strong>
                    {(page - 1) * 6 + 1}–{Math.min(page * 6, matches.length)}
                  </strong>{" "}
                  {t('sur', 'of', 'van')} {matches.length} {t('activités', 'activities', 'activiteiten')}
                </p>
                {pages > 1 && (
                  <nav aria-label={t('Pagination du catalogue', 'Catalogue pages', 'Cataloguspagina’s')}>
                    <button
                      aria-label={t('Page précédente', 'Previous page', 'Vorige pagina')}
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
                      aria-label={t('Page suivante', 'Next page', 'Volgende pagina')}
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
                  ? t('Vérifiez les dates choisies', 'Check the selected dates', 'Controleer de gekozen datums')
                  : t('Pas encore de découverte pour ces critères', 'No activities match these filters yet', 'Nog geen activiteiten voor deze filters')}
              </h3>
              <p>
                {invalidRange
                  ? t('Choisissez une date de fin égale ou postérieure à la date de début.', 'Choose an end date on or after the start date.', 'Kies een einddatum op of na de begindatum.')
                  : t('Essayez une autre ville ou élargissez vos filtres pour explorer la sélection.', 'Try another city or broaden your filters.', 'Probeer een andere stad of verruim uw filters.')}
              </p>
              <button className="button navy" onClick={reset}>
                {t('Réinitialiser tous les critères', 'Reset all filters', 'Alle filters herstellen')}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
