import { useActivities } from "../context/catalogStore";
import { useState } from "react";
import type { ReactNode } from "react";
import { categories } from "../data/activities";
import type { Activity } from "../data/activities";
import { Icon } from "../components/Icon";
import "./ActivityDetail.css";

export function ActivityDetail({
  activity,
  saved,
  onSave,
  onRegister,
  card,
}: {
  activity: Activity | undefined;
  saved: boolean;
  onSave: () => void;
  onRegister: (quantity: number) => void;
  card: (activity: Activity) => ReactNode;
}) {
  const activities = useActivities();
  const [quantity, setQuantity] = useState(1);
  const [shareMessage, setShareMessage] = useState("");
  if (!activity)
    return (
      <section className="container detail-not-found">
        <p className="eyebrow teal">BELCONNECT</p>
        <h1 tabIndex={-1}>Cette activité est introuvable</h1>
        <p>Découvrez les activités disponibles dans notre sélection.</p>
        <a className="button navy" href="/activites">
          Retour au catalogue
          <Icon name="arrow" />
        </a>
      </section>
    );
  const detail = activity.details;
  const full = detail.remaining === 0;
  const category = categories.find((c) => c.id === activity.category)!;
  const date = new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "full",
    timeZone: "Europe/Brussels",
  }).format(new Date(activity.startsAt));
  const time = new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  }).format(new Date(activity.startsAt));
  const money = (value: number) =>
    new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value);
  const recommendations = activities
    .filter((a) => a.id !== activity.id && a.details.remaining > 0)
    .sort(
      (a, b) =>
        Number(b.category === activity.category) -
        Number(a.category === activity.category),
    )
    .slice(0, 3);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Lien de l’activité copié.");
    } catch {
      setShareMessage(
        "Copiez l’adresse de cette page pour partager l’activité.",
      );
    }
  };
  return (
    <div className="detail-page container">
      <nav className="breadcrumbs" aria-label="Fil d’Ariane">
        <a href="/">Accueil</a>
        <Icon name="chevron" />
        <a href="/activites">Activités</a>
        <Icon name="chevron" />
        <a href={`/activites?category=${activity.category}`}>
          {category.label}
        </a>
      </nav>
      <div className="detail-tags">
        <span>
          <Icon name={category.icon} />
          {category.label}
        </span>
        <span>
          <Icon name="pin" />
          {activity.city}
        </span>
        {full && <span className="full-tag">Activité complète</span>}
      </div>
      <h1 tabIndex={-1}>{activity.title}</h1>
      <div className="detail-heading-row">
        <p>
          <span className="host-avatar">
            <Icon name="users" />
          </span>
          Proposé par <strong>{activity.host}</strong>
        </p>
        <div className="detail-actions">
          <button onClick={share}>
            <Icon name="arrow" />
            Partager
          </button>
          <button
            aria-pressed={saved}
            onClick={onSave}
            className={saved ? "is-saved" : ""}
          >
            <Icon name="heart" />
            {saved ? "Enregistrée" : "Sauvegarder"}
          </button>
        </div>
      </div>
      <p className="share-feedback" role="status">
        {shareMessage}
      </p>
      <div className="detail-layout">
        <div className="detail-content">
          <div className="detail-hero">
            <img src={`/images/${activity.image}.jpg`} alt={activity.title} />
            <span>
              {category.label} · {activity.city}
            </span>
            <span>{detail.capacity} participants maximum</span>
          </div>
          <section
            className="detail-facts"
            aria-label="Les informations essentielles"
          >
            <div>
              <Icon name="calendar" />
              <span>
                <small>DATE & DURÉE</small>
                <strong>{date}</strong>
                <span>
                  {time} · {detail.duration}
                </span>
              </span>
            </div>
            <div>
              <Icon name="pin" />
              <span>
                <small>LIEU DE RENDEZ-VOUS</small>
                <strong>{detail.meetingPoint}</strong>
                <span>Adresse précise à confirmer</span>
              </span>
            </div>
            <div>
              <Icon name="users" />
              <span>
                <small>PLACES & PUBLIC</small>
                <strong>
                  {full
                    ? "Toutes les places sont prises"
                    : `${detail.remaining} places disponibles sur ${detail.capacity}`}
                </strong>
                <span>{detail.audience}</span>
              </span>
            </div>
            <div>
              <Icon name="ticket" />
              <span>
                <small>TARIF PAR PERSONNE</small>
                <strong>
                  {activity.price === 0
                    ? "Activité gratuite"
                    : money(activity.price)}
                </strong>
                <span>Tarif et disponibilité de démonstration</span>
              </span>
            </div>
          </section>
          <section className="detail-panel">
            <h2>Description de l’expérience</h2>
            <p>{activity.description}</p>
            <p>
              Un moment pour découvrir un savoir-faire, rencontrer des personnes
              du coin et vivre la Belgique autrement, avec {activity.host}.
            </p>
            <div className="program-box">
              <h3>
                <Icon name="calendar" />
                Au programme
              </h3>
              <ol>
                {detail.program.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <h3 className="included-title">
              Ce qui est prévu pour cette activité
            </h3>
            <ul className="included-list">
              {detail.included.map((item) => (
                <li key={item}>
                  <Icon name="ticket" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-panel">
            <h2>Informations pratiques</h2>
            <div className="practical-grid">
              <div>
                <h3>À prévoir</h3>
                <p>{detail.preparation}</p>
              </div>
              <div>
                <h3>Accessibilité</h3>
                <p>
                  Les conditions d’accueil et d’accessibilité seront précisées
                  par l’organisateur avant l’ouverture des inscriptions.
                </p>
              </div>
            </div>
            <div className="meeting-point">
              <span className="meeting-icon">
                <Icon name="pin" />
              </span>
              <div>
                <h3>{detail.meetingPoint}</h3>
                <p>
                  Localisation indicative · le rendez-vous exact reste à
                  confirmer.
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.meetingPoint + ", Belgique")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir le quartier
                <Icon name="arrow" />
              </a>
            </div>
          </section>
          <section className="detail-panel host-panel">
            <span className="host-avatar">
              <Icon name="users" />
            </span>
            <div>
              <p className="eyebrow teal">L’ORGANISATEUR</p>
              <h2>{activity.host}</h2>
              <p>
                Une initiative locale à {activity.city}, pour partager des
                découvertes et créer des liens.
              </p>
              <a href={`/activites?city=${encodeURIComponent(activity.city)}`}>
                Explorer les activités à {activity.city}
                <Icon name="arrow" />
              </a>
            </div>
          </section>
        </div>
        <aside
          className={`booking-panel ${full ? "booking-full" : ""}`}
          aria-label="Inscription à l’activité"
        >
          <div className="booking-top">
            <span className="eyebrow teal">VOTRE PROCHAINE DÉCOUVERTE</span>
            <strong>
              {activity.price === 0 ? "Gratuit" : money(activity.price)}
            </strong>
            <span>
              {activity.price === 0
                ? "Une activité ouverte à la découverte"
                : "par personne"}
            </span>
          </div>
          <div className="booking-date">
            <Icon name="calendar" />
            <div>
              <strong>{date}</strong>
              <span>
                {time} · {detail.duration}
              </span>
            </div>
          </div>
          <div className={`availability ${full ? "unavailable" : ""}`}>
            <span />
            {full
              ? "Toutes les places sont prises"
              : `${detail.remaining} places encore disponibles`}
          </div>
          {full ? (
            <div className="full-message">
              <h2>On se retrouve une prochaine fois ?</h2>
              <p>
                Cette session a atteint sa capacité de {detail.capacity}{" "}
                participants. D’autres découvertes vous attendent.
              </p>
              <button className="button full-button" disabled>
                Activité complète
              </button>
              <a className="button navy" href="#autres-activites">
                Découvrir d’autres activités
                <Icon name="arrow" />
              </a>
            </div>
          ) : (
            <>
              <label className="quantity-label" htmlFor="participant-count">
                Nombre de participants
              </label>
              <div className="quantity-control">
                <button
                  aria-label="Retirer un participant"
                  disabled={quantity === 1}
                  onClick={() => setQuantity((q) => q - 1)}
                >
                  −
                </button>
                <output id="participant-count" aria-live="polite">
                  {quantity}
                </output>
                <button
                  aria-label="Ajouter un participant"
                  disabled={quantity >= Math.min(4, detail.remaining)}
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
              <p className="quantity-help">
                Jusqu’à {Math.min(4, detail.remaining)} participants par
                inscription dans cette démo.
              </p>
              <div className="booking-total">
                <span>
                  Total pour {quantity} personne{quantity > 1 ? "s" : ""}
                </span>
                <strong>
                  {activity.price === 0
                    ? "Gratuit"
                    : money(activity.price * quantity)}
                </strong>
              </div>
              <button
                className="button coral register-button"
                onClick={() => onRegister(quantity)}
              >
                <Icon name="ticket" />
                {activity.price === 0
                  ? "S’inscrire gratuitement"
                  : "S’inscrire"}
                <Icon name="arrow" />
              </button>
            </>
          )}
          <p className="booking-demo">
            Activités de démonstration. Les réservations gratuites sont enregistrées dans votre compte. Les inscriptions payantes restent simulées.
          </p>
        </aside>
      </div>
      <section className="detail-related" id="autres-activites">
        <div className="section-heading">
          <div>
            <p className="eyebrow coral-text">PROLONGEZ VOS DÉCOUVERTES</p>
            <h2>
              {full
                ? "Il reste de belles occasions de sortir"
                : "Ces activités pourraient aussi vous plaire"}
            </h2>
          </div>
          <a className="text-link" href="/activites">
            Tout le catalogue
            <Icon name="arrow" />
          </a>
        </div>
        <div className="activity-grid">{recommendations.map(card)}</div>
      </section>
    </div>
  );
}
