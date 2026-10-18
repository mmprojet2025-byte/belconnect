import { Groups } from './pages/Groups';
import { Projects } from './pages/Projects';
import { currentUser, signOut } from "./lib/auth";
import type { UserProfile } from "./lib/auth";
import { useActivities } from "./context/catalogStore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { categories } from "./data/activities";
import type { Activity } from "./data/activities";
import { ActivityCard } from "./components/ActivityCard";
import { Icon } from "./components/Icon";
import "./App.css";
import { AuthPage } from "./pages/AuthPage";
import { PaymentPage } from "./pages/PaymentPage";
import type { PaymentAttempt } from "./pages/PaymentPage";
import { EnrollmentPage } from "./pages/EnrollmentPage";
import { bookingQuantity, bookingUrl, paymentDraftKey } from "./lib/booking";
import type { EnrollmentDraft } from "./lib/booking";
import { ActivityDetail } from "./pages/ActivityDetail";
import { Catalogue } from "./pages/Catalogue";
import { catalogueUrl, navigate, useLocation } from "./lib/navigation";

type Preview = {
  title: string;
  description: string;
  image?: string;
  activity?: Activity;
};
function App() {
  const activities = useActivities();
  const location = useLocation();
  const pathname = location.split(/[?#]/)[0];
  const isGroups = pathname === "/groupes";
  const isProject = pathname === "/projets" || pathname.startsWith("/projets/");
  const isCatalogue = pathname === "/activites";
  const isDetail = pathname.startsWith("/activites/");
  const selectedActivity = activities.find(
    (a) => a.id === pathname.split("/")[2],
  );
  const step = pathname.split("/")[3];
  const isFlow =
    !!selectedActivity &&
    [
      "connexion",
      "inscription",
      "recapitulatif",
      "paiement",
      "confirmation",
      "echec",
    ].includes(step) &&
    selectedActivity.details.remaining > 0;
  const isAuth = pathname === "/connexion" || pathname === "/mon-espace";
  const quantity = selectedActivity
    ? bookingQuantity(selectedActivity, location.split("?")[1] || "")
    : 1;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EnrollmentDraft>>({});
  const [payments, setPayments] = useState<Record<string, PaymentAttempt>>({});
  const userId = useRef<number | null>(null);
  const authRevision = useRef(0);
  const acceptUser = useCallback((profile: UserProfile | null) => {
    authRevision.current++;
    if (userId.current !== (profile?.id ?? null)) { setDrafts({}); setPayments({}); }
    userId.current = profile?.id ?? null;
    setUser(profile);
  }, []);
  const logout = async () => {
    await signOut();
    setPayments({});
    acceptUser(null);
    setDrafts({});
  };
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const revision = authRevision.current;
      currentUser(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
        .then(profile => { if (!controller.signal.aborted && revision === authRevision.current) { acceptUser(profile); setSessionError(""); } })
        .catch(() => { if (!controller.signal.aborted) setSessionError("Impossible de vérifier la session. Vérifiez la connexion au serveur."); })
        .finally(() => { if (!controller.signal.aborted) setSessionReady(true); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [acceptUser]);
  const isSignedIn = Boolean(user);
  const detailTitle = selectedActivity?.title;

  useEffect(() => {
    document.title = isGroups ? "Groupes — Belconnect" : isProject ? "Projets — Belconnect" : isAuth
      ? isSignedIn ? "Mon espace — Belconnect" : "Connexion — Belconnect"
      : isFlow
        ? `Inscription · ${detailTitle} — Belconnect`
        : isDetail
          ? `${detailTitle || "Activité introuvable"} — Belconnect`
          : isCatalogue
            ? "Activités en Belgique — Belconnect"
            : "Belconnect — La Belgique, à vivre ensemble";
    if (window.location.hash)
      requestAnimationFrame(() =>
        document
          .getElementById(window.location.hash.slice(1))
          ?.scrollIntoView(),
      );
    else {
      window.scrollTo({ top: 0, behavior: "instant" });
      document
        .querySelector<HTMLElement>("main h1")
        ?.focus({ preventScroll: true });
    }
  }, [isGroups, isProject, isCatalogue, isDetail, isAuth, isFlow, detailTitle, pathname, isSignedIn]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [period, setPeriod] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const categoryRow = useRef<HTMLDivElement>(null);
  const openPreview = (value: Preview) => {
    opener.current = document.activeElement as HTMLElement;
    setPreview(value);
    dialog.current?.showModal();
  };
  const closePreview = () => {
    dialog.current?.close();
    opener.current?.focus();
  };
  const upcoming = (title: string, description: string) => {
    setMenuOpen(false);
    openPreview({ title, description });
  };
  const showResults = (values: Record<string, string> = {}) => {
    setMenuOpen(false);
    navigate(catalogueUrl(values));
  };
  const search = (event: FormEvent) => {
    event.preventDefault();
    showResults({ query: query.trim(), city, period });
  };
  const selectCategory = (category: string) => showResults({ category });
  const reset = () => {
    setQuery("");
    setCity("");
    setPeriod("");
  };
  const card = (activity: Activity) => (
    <ActivityCard
      key={activity.id}
      activity={activity}
      saved={saved.includes(activity.id)}
      onSave={() =>
        setSaved((current) =>
          current.includes(activity.id)
            ? current.filter((id) => id !== activity.id)
            : [...current, activity.id],
        )
      }
    />
  );

  return (
    <div
      onClick={(event) => {
        const link = (event.target as HTMLElement).closest("a");
        if (
          !link ||
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        const href = link.getAttribute("href");
        if (href?.startsWith("/")) {
          event.preventDefault();
          setMenuOpen(false);
          navigate(href);
          if (href.includes("#"))
            requestAnimationFrame(() =>
              document.getElementById(href.split("#")[1])?.scrollIntoView(),
            );
        }
      }}
    >
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <a
            className="brand"
            href="/"
            onClick={reset}
            aria-label="Belconnect, accueil"
          >
            <span className="brand-symbol">
              b<span>•</span>
            </span>
            <span>
              Bel<span>connect</span>
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navigation principale">
            <a
              className={isCatalogue || isDetail ? "active" : ""}
              aria-current={isCatalogue ? "page" : undefined}
              href="/activites"
            >
              Activités
            </a>
            <a href="/projets">Projets</a>
            <a href="/groupes" onClick={() => setMenuOpen(false)}>Groupes</a>
          </nav>
          <div className="header-actions">
            <button
              className="button outline organize"
              onClick={() =>
                upcoming(
                  "Organiser une activité",
                  "Un espace dédié permettra aux organisateurs de proposer et gérer leurs activités sur Belconnect. Nous préparons ce parcours.",
                )
              }
            >
              Organiser une activité
            </button>
            <a className="login" href={user ? "/mon-espace" : "/connexion"}>
              {user ? "Mon espace" : "Connexion"}
            </a>
          </div>
          <button
            className="menu-button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label="Navigation mobile"
          >
            <a href="/activites" onClick={() => setMenuOpen(false)}>
              Activités
            </a>
            <a href="/projets" onClick={() => setMenuOpen(false)}>
              Projets
            </a>
            <a href="/groupes" onClick={() => setMenuOpen(false)}>Groupes</a>
            <a className="login" href={user ? "/mon-espace" : "/connexion"}>
              {user ? "Mon espace" : "Connexion"}
            </a>
            <a href="/#organisateurs" onClick={() => setMenuOpen(false)}>
              Organiser une activité
            </a>
          </nav>
        )}
      </header>
      <main id="contenu">
        {sessionError && <p className="container" role="alert">{sessionError}</p>}
        {(isAuth || isFlow) && !sessionReady ? <p className="container" role="status">Vérification de votre session…</p> : isAuth ? (
          <AuthPage user={user} onLogout={logout} onComplete={profile => {
            acceptUser(profile);
            const target = new URLSearchParams(location.split('?')[1] || '').get('retour');
            if (target && (target === "/groupes" || /^\/projets\/[1-9]\d*$/.test(target))) navigate(target);
          }} />
        ) : isGroups ? (
          <Groups key={user?.id ?? "public"} signedIn={isSignedIn} />
        ) : isProject ? (
          <Projects key={`${pathname}-${user?.id ?? "public"}`} id={pathname.split("/")[2]} signedIn={isSignedIn} />
        ) : isFlow && selectedActivity ? (
          !user || step === "connexion" ? (
            <AuthPage
              key={selectedActivity.id}
              activity={selectedActivity}
              quantity={quantity}
              user={user}
              onLogout={logout}
              onComplete={(profile) => {
                acceptUser(profile);
                navigate(
                  bookingUrl(selectedActivity.id, "inscription", quantity),
                );
              }}
            />
          ) : ["paiement", "confirmation", "echec"].includes(step) &&
            selectedActivity.price > 0 &&
            drafts[selectedActivity.id]?.acknowledged &&
            drafts[selectedActivity.id]?.reviewedQuantity === quantity ? (
            <PaymentPage
              key={location}
              activity={selectedActivity}
              quantity={quantity}
              draft={drafts[selectedActivity.id]}
              step={step}
              attempt={
                payments[selectedActivity.id]?.draftKey ===
                paymentDraftKey(drafts[selectedActivity.id])
                  ? payments[selectedActivity.id]
                  : undefined
              }
              onResult={(attempt) => {
                setPayments((current) => ({
                  ...current,
                  [selectedActivity.id]: attempt,
                }));
                navigate(
                  bookingUrl(
                    selectedActivity.id,
                    attempt.outcome === "success" ? "confirmation" : "echec",
                    quantity,
                  ),
                );
              }}
            />
          ) : (
            <EnrollmentPage
              key={selectedActivity.id}
              activity={selectedActivity}
              quantity={quantity}
              user={user}
              draft={drafts[selectedActivity.id]}
              onDraft={(draft) =>
                setDrafts((current) => ({
                  ...current,
                  [selectedActivity.id]: draft,
                }))
              }
              review={step !== "inscription"}
            />
          )
        ) : isDetail ? (
          <ActivityDetail
            key={pathname}
            activity={selectedActivity}
            saved={!!selectedActivity && saved.includes(selectedActivity.id)}
            onSave={() => {
              if (selectedActivity)
                setSaved((current) =>
                  current.includes(selectedActivity.id)
                    ? current.filter((id) => id !== selectedActivity.id)
                    : [...current, selectedActivity.id],
                );
            }}
            onRegister={(quantity) => {
              if (selectedActivity)
                navigate(
                  bookingUrl(
                    selectedActivity.id,
                    user ? "inscription" : "connexion",
                    quantity,
                  ),
                );
            }}
            card={card}
          />
        ) : isCatalogue ? (
          <Catalogue card={card} location={location} />
        ) : (
          <>
            <section className="hero">
              <div className="container hero-inner">
                <span className="eyebrow-pill">
                  <span />
                  Des découvertes, des rencontres, près de chez vous
                </span>
                <h1 tabIndex={-1}>
                  La Belgique se découvre.
                  <br />
                  <span>Ensemble, c’est encore mieux.</span>
                </h1>
                <p className="hero-description">
                  Ateliers créatifs, balades nature, saveurs locales et moments
                  partagés.
                  <br className="desktop-break" /> Trouvez votre prochaine
                  activité, juste à côté de chez vous.
                </p>
                <form
                  className="search-bar"
                  onSubmit={search}
                  role="search"
                  aria-label="Rechercher une activité"
                >
                  <label className="search-field keyword">
                    <Icon name="search" />
                    <span>
                      <span className="field-label">UNE ENVIE ?</span>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Céramique, chocolat, rando…"
                        aria-label="Mot-clé"
                      />
                    </span>
                  </label>
                  <label className="search-field">
                    <Icon name="pin" />
                    <span>
                      <span className="field-label">OÙ ?</span>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        aria-label="Ville"
                      >
                        <option value="">Toute la Belgique</option>
                        {[
                          "Bruxelles",
                          "Liège",
                          "Namur",
                          "Charleroi",
                          "Malmedy",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="search-field">
                    <Icon name="calendar" />
                    <span>
                      <span className="field-label">QUAND ?</span>
                      <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        aria-label="Période"
                      >
                        <option value="">Toutes les dates</option>
                        <option value="weekend">Le week-end</option>
                      </select>
                    </span>
                  </label>
                  <button className="button coral" type="submit">
                    <Icon name="search" />
                    Rechercher
                  </button>
                </form>
                <div className="suggestions">
                  <span>Un peu d’inspiration :</span>
                  {[
                    ["Ateliers chocolat", "chocolat"],
                    ["Randonnée Ardennes", "randonnée"],
                    ["Céramique", "céramique"],
                  ].map(([label, term]) => (
                    <button
                      key={term}
                      onClick={() => {
                        showResults({ query: term });
                      }}
                    >
                      {label}
                      <span>↗</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section
              className="container categories-section"
              aria-labelledby="categories-title"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow teal">À CHACUN SES ENVIES</p>
                  <h2 id="categories-title">Qu’est-ce qui vous fait envie ?</h2>
                </div>
                <div className="category-arrows">
                  <button
                    aria-label="Catégories précédentes"
                    onClick={() =>
                      categoryRow.current?.scrollBy({
                        left: -300,
                        behavior: "smooth",
                      })
                    }
                  >
                    <Icon name="arrow" className="reverse" />
                  </button>
                  <button
                    aria-label="Catégories suivantes"
                    onClick={() =>
                      categoryRow.current?.scrollBy({
                        left: 300,
                        behavior: "smooth",
                      })
                    }
                  >
                    <Icon name="arrow" />
                  </button>
                </div>
              </div>
              <div className="categories" ref={categoryRow}>
                {categories.map((c, index) => (
                  <button
                    className={`category category-${index} `}
                    key={c.id}
                    onClick={() => selectCategory(c.id)}
                  >
                    <span className="category-icon">
                      <Icon name={c.icon} />
                    </span>
                    <strong>{c.label}</strong>
                    <span>
                      Explorer <span aria-hidden="true">↗</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="popular-section" id="activites">
              <div className="container">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow coral-text">
                      L’INSPIRATION EST TOUT PRÈS
                    </p>
                    <h2>Des activités à ne pas manquer</h2>
                    <p>
                      Des idées pour sortir, apprendre et partager de bons
                      moments.
                    </p>
                  </div>
                  <button className="text-link" onClick={() => showResults()}>
                    Explorer le catalogue
                    <Icon name="arrow" />
                  </button>
                </div>
                <div className="activity-grid">
                  {activities.filter((a) => a.price > 0).map(card)}
                </div>
              </div>
            </section>
            {
              <section className="container free-section">
                <div className="free-banner">
                  <span className="free-icon">
                    <Icon name="ticket" />
                  </span>
                  <div>
                    <p className="eyebrow">OUVERT À TOUS • SANS FRAIS</p>
                    <h2>Les belles découvertes n’ont pas de prix.</h2>
                  </div>
                  <p>
                    Culture, nature et vie de quartier :<br />
                    faites le plein de rencontres, gratuitement.
                  </p>
                </div>
                <div className="activity-grid free-grid">
                  {activities.filter((a) => a.price === 0).map(card)}
                </div>
              </section>
            }
            <section id="projets" className="projects-section"><div className="container"><Projects key={user?.id ?? 'public'} compact /></div></section>
            <section className="container organizer-section" id="organisateurs">
              <div className="organizer-banner">
                <div>
                  <span className="organizer-pill">
                    <Icon name="users" />
                    Pour ceux qui font vivre nos quartiers
                  </span>
                  <h2>
                    Votre passion mérite
                    <br />
                    d’être partagée.
                  </h2>
                  <p>
                    Vous animez un atelier ou organisez des sorties en Belgique
                    ?
                    <br />
                    Faites découvrir votre activité à une communauté curieuse.
                  </p>
                  <button
                    className="button coral"
                    onClick={() =>
                      upcoming(
                        "Partagez votre passion",
                        "Le parcours organisateur permettra de présenter votre activité, de proposer des dates et de gérer les inscriptions. Il sera construit dans une prochaine étape.",
                      )
                    }
                  >
                    Proposer une activité
                    <Icon name="arrow" />
                  </button>
                </div>
                <div className="organizer-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <span className="art-leaf">
                    <Icon name="leaf" />
                  </span>
                  <span className="art-cup">
                    <Icon name="cup" />
                  </span>
                  <span className="art-heart">
                    <Icon name="heart" />
                  </span>
                  <span className="art-caption">
                    Un savoir-faire.
                    <br />
                    Mille rencontres.
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <a className="brand" href="/">
              <span className="brand-symbol">
                b<span>•</span>
              </span>
              <span>
                Bel<span>connect</span>
              </span>
            </a>
            <p>La Belgique, à vivre ensemble.</p>
            <span className="demo-label">
              Première version · Données de démonstration
            </span>
          </div>
          <div>
            <h3>Explorer la Belgique</h3>
            {["Bruxelles", "Liège", "Namur", "Charleroi"].map((v) => (
              <button
                key={v}
                onClick={() => {
                  showResults({ city: v });
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <div>
            <h3>Trouvez votre inspiration</h3>
            {categories.slice(0, 4).map((c) => (
              <button key={c.id} onClick={() => selectCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div>
            <h3>Ensemble</h3>
            <a href="/projets">Les projets locaux</a>
            <a href="/#organisateurs">Organiser une activité</a>
            <button
              onClick={() =>
                upcoming(
                  "Bienvenue sur Belconnect",
                  "Belconnect rassemble les activités locales, les projets citoyens et les personnes qui souhaitent partager de bons moments en Belgique.",
                )
              }
            >
              À propos de Belconnect
            </button>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Belconnect</span>
          <span>Fait pour les rencontres, près de chez vous.</span>
          <span>Français (Belgique)</span>
        </div>
      </footer>
      <dialog
        ref={dialog}
        className="preview-dialog"
        aria-labelledby="preview-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePreview();
        }}
        onClose={() => opener.current?.focus()}
      >
        <button
          className="dialog-close"
          onClick={closePreview}
          aria-label="Fermer l’aperçu"
          autoFocus
        >
          <Icon name="close" />
        </button>
        {preview && (
          <>
            {preview.image && (
              <img
                className="dialog-image"
                src={`/images/${preview.image}.jpg`}
                alt=""
              />
            )}
            <div className="dialog-content">
              <p className="eyebrow teal">APERÇU BELCONNECT</p>
              <h2 id="preview-title">{preview.title}</h2>
              <p>{preview.description}</p>
              {preview.activity && (
                <div className="dialog-details">
                  <span>
                    <Icon name="pin" />
                    {preview.activity.location}
                  </span>
                  <span>
                    <Icon name="calendar" />
                    {preview.activity.date}
                  </span>
                  <strong>
                    {preview.activity.price === 0
                      ? "Gratuit"
                      : `${preview.activity.price} € par personne`}
                  </strong>
                </div>
              )}
              <p className="preview-note">
                {preview.activity
                  ? "Activité de démonstration. La fiche détaillée et les inscriptions seront ajoutées dans une prochaine étape."
                  : "Vous explorez la première version de Belconnect."}
              </p>
              <button className="button navy" onClick={closePreview}>
                Continuer la découverte
                <Icon name="arrow" />
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
export default App;
