import { postJson } from "../lib/auth";
import type { UserProfile } from "../lib/auth";
import { useRef, useState } from "react";
import type { Activity } from "../data/activities";
import { bookingUrl, money } from "../lib/booking";
import type {  EnrollmentDraft } from "../lib/booking";
import { navigate } from "../lib/navigation";
import { BookingSummary } from "../components/BookingSummary";
import { Icon } from "../components/Icon";
import "./Enrollment.css";
export function EnrollmentPage({
  activity,
  quantity,
  user,
  draft,
  onDraft,
  review,
}: {
  activity: Activity;
  quantity: number;
  user: UserProfile;
  draft: EnrollmentDraft | undefined;
  onDraft: (draft: EnrollmentDraft) => void;
  review: boolean;
}) {
  const submitted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get("paiement") === "annule"
    ? "Le paiement a été interrompu. Votre inscription n'est pas confirmée." : "");
  async function confirmBooking() {
    if (submitted.current) return;
    submitted.current = true; setBusy(true); setError("");
    try {
      await postJson("/api/bookings", { ...value, activityId: activity.id, quantity });
      window.dispatchEvent(new Event("catalog-refresh"));
      navigate("/mon-espace?inscription=confirmee#mes-inscriptions");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Inscription impossible."); }
    finally { submitted.current = false; setBusy(false); }
  }
  async function startPaidCheckout() {
    if (submitted.current) return;
    submitted.current = true; setBusy(true); setError("");
    const key = `belconnect-paid-activity-${user.id}-${activity.id}-${quantity}`;
    const existing = window.sessionStorage.getItem(key);
    const requestId = existing || crypto.randomUUID();
    if (!existing) window.sessionStorage.setItem(key, requestId);
    try {
      const checkout: { url: string } = await postJson("/api/paid-activity-bookings", {
        requestId, activityId: activity.id, quantity,
        firstName: value.firstName, lastName: value.lastName,
        email: value.email, phone: value.phone, acknowledged: value.acknowledged,
      });
      if (!checkout.url.startsWith("https://checkout.stripe.com/")) throw new Error("Lien de paiement invalide.");
      window.location.assign(checkout.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Paiement indisponible. Réessayez."); }
    finally { submitted.current = false; setBusy(false); }
  }
  const details = activity.details;
  const value: EnrollmentDraft = draft || {
    ...user,
    phone: "",
    acknowledged: false,
    reviewedQuantity: null,
  };
  const complete =
    review && value.reviewedQuantity === quantity && value.acknowledged;
  const update = (patch: Partial<EnrollmentDraft>) =>
    onDraft({ ...value, ...patch, reviewedQuantity: null });
  const changeQuantity = (next: number) => {
    update({});
    navigate(bookingUrl(activity.id, "inscription", next), true);
  };
  return (
    <section className="enrollment-shell">
      <div className="container enrollment-container">
        <a
          className="flow-back"
          href={
            complete
              ? bookingUrl(activity.id, "inscription", quantity)
              : `/activites/${activity.id}`
          }
        >
          <Icon name="arrow" className="reverse" />
          {complete ? "Modifier mon inscription" : "Retour à l’activité"}
        </a>
        <ol className="flow-steps" aria-label="Étapes de l’inscription">
          <li className="step-done">
            <span>✓</span>Connexion
          </li>
          <li
            aria-current={!complete ? "step" : undefined}
            className={complete ? "step-done" : ""}
          >
            <span>{complete ? "✓" : "2"}</span>Inscription
          </li>
          <li aria-current={complete ? "step" : undefined}>
            <span>3</span>Récapitulatif
          </li>
          {activity && activity.price > 0 && (
            <li>
              <span>4</span>Paiement
            </li>
          )}
        </ol>
        <div className="enrollment-title">
          <p className="eyebrow teal">
            {complete ? "VOTRE PARCOURS BELCONNECT" : "ENCORE QUELQUES DÉTAILS"}
          </p>
          <h1 tabIndex={-1}>
            {complete
              ? activity.price === 0
                ? "Vérifiez votre inscription"
                : "Vos informations sont prêtes pour la suite"
              : "Préparez votre prochaine découverte"}
          </h1>
          <p>
            {complete
              ? "Retrouvez ci-dessous le récapitulatif de votre sélection."
              : "Vérifiez le nombre de places et renseignez les coordonnées du participant principal."}
          </p>
        </div>
        {!complete && error && <p role="alert" className="inline-notice">{error}</p>}
        <div className="enrollment-grid">
          <div className="enrollment-content">
            <BookingSummary activity={activity} quantity={quantity} />
            {complete ? (
              <section className="enrollment-card review-card">
                <span className="review-icon">
                  <Icon name={activity.price === 0 ? "ticket" : "calendar"} />
                </span>
                <h2>
                  {activity.price === 0
                    ? "Confirmez votre réservation gratuite"
                    : "Prochaine étape : le paiement"}
                </h2>
                <p>
                  {activity.price === 0
                    ? "La confirmation enregistrera votre inscription et réservera les places dans Belconnect."
                    : activity.demonstration
                      ? "Votre formulaire est rempli. Vous pouvez maintenant découvrir le paiement de démonstration. Cette activité n’est pas encore réservée."
                      : "Votre formulaire est rempli. Stripe ouvrira sa page de paiement sécurisée. L'inscription sera confirmée dans Mon espace après validation du paiement."}
                </p>
                <dl>
                  <div>
                    <dt>Participant principal</dt>
                    <dd>
                      {value.firstName} {value.lastName}
                    </dd>
                  </div>
                  <div>
                    <dt>Adresse e-mail</dt>
                    <dd>{value.email}</dd>
                  </div>
                  {value.phone && (
                    <div>
                      <dt>Téléphone</dt>
                      <dd>{value.phone}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Participants</dt>
                    <dd>{quantity}</dd>
                  </div>
                  <div>
                    <dt>Total indicatif</dt>
                    <dd>
                      {activity.price === 0
                        ? "Gratuit"
                        : money(quantity * activity.price)}
                    </dd>
                  </div>
                </dl>
                <div className="demo-notice">
                  <strong>{activity.price === 0 ? "Confirmation avant réservation" : activity.demonstration ? "Une simulation, sans réservation" : "Paiement sécurisé par Stripe"}</strong>
                  <p>
                    {activity.price === 0 ? activity.demonstration ? "Votre inscription sera conservée dans Mon espace. Cette activité est un exemple : aucun événement réel ni e-mail ne sont confirmés." : "Votre inscription sera conservée dans Mon espace. Aucun e-mail n'est envoyé pour le moment." : activity.demonstration ? "Aucun paiement, e-mail ou billet n’a été généré. Le paiement reste simulé." : "Les places sont retenues pendant le paiement. Le retour de Stripe ne confirme pas à lui seul l'inscription : vérifiez son état dans Mon espace."}
                  </p>
                </div>
                {error && <p role="alert" className="inline-notice">{error} <a href="/mon-espace#mes-inscriptions">Mon espace</a></p>}
                <div className="review-actions">
                  {activity.price === 0 && <button className="button coral" disabled={busy} onClick={confirmBooking}>{busy ? "Enregistrement…" : "Confirmer mon inscription gratuite"}</button>}
                  {activity.price > 0 && activity.demonstration && (
                    <a
                      className="button coral"
                      href={bookingUrl(activity.id, "paiement", quantity)}
                    >
                      Continuer vers le paiement
                      <Icon name="arrow" />
                    </a>
                  )}
                  {activity.price > 0 && !activity.demonstration && <button className="button coral" disabled={busy} onClick={startPaidCheckout}>{busy ? "Ouverture de Stripe…" : "Payer avec Stripe"}<Icon name="arrow" /></button>}
                  <a className="button navy" href="/activites">
                    Continuer la découverte
                    <Icon name="arrow" />
                  </a>
                  <a
                    className="button outline"
                    href={bookingUrl(activity.id, "inscription", quantity)}
                  >
                    Modifier les informations
                  </a>
                </div>
              </section>
            ) : (
              <>
                <section className="enrollment-card places-card">
                  <div>
                    <h2>Nombre de places</h2>
                    <p>
                      {details.remaining} places disponibles{activity.demonstration ? ' dans cette démonstration' : ' pour cette activité'}.
                    </p>
                  </div>
                  <div className="registration-quantity">
                    <span>Participant{quantity > 1 ? "s" : ""}</span>
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label="Retirer un participant"
                        disabled={quantity === 1}
                        onClick={() => changeQuantity(quantity - 1)}
                      >
                        −
                      </button>
                      <output aria-live="polite">{quantity}</output>
                      <button
                        type="button"
                        aria-label="Ajouter un participant"
                        disabled={quantity >= Math.min(4, details.remaining)}
                        onClick={() => changeQuantity(quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </section>
                <form
                  className="enrollment-card flow-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (submitted.current) return;
                    submitted.current = true;
                    onDraft({
                      ...value,
                      firstName: value.firstName.trim(),
                      lastName: value.lastName.trim(),
                      email: value.email.trim(),
                      phone: value.phone.trim(),
                      reviewedQuantity: quantity,
                    });
                    navigate(
                      bookingUrl(activity.id, "recapitulatif", quantity),
                    );
                    requestAnimationFrame(() => {
                      submitted.current = false;
                    });
                  }}
                >
                  <div>
                    <h2>Coordonnées du participant principal</h2>
                    <p className="form-description">
                      Vos coordonnées sont préremplies depuis votre compte. 
                      Les champs marqués d’un * sont obligatoires.
                    </p>
                  </div>
                  <div className="form-pair">
                    <label>
                      Prénom *
                      <input
                        autoComplete="off"
                        required
                        pattern=".*\S.*"
                        value={value.firstName}
                        onChange={(e) => update({ firstName: e.target.value })}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      Nom *
                      <input
                        autoComplete="off"
                        required
                        pattern=".*\S.*"
                        value={value.lastName}
                        onChange={(e) => update({ lastName: e.target.value })}
                        maxLength={80}
                      />
                    </label>
                  </div>
                  <label>
                    Adresse e-mail *
                    <input
                      type="email"
                      autoComplete="off"
                      required
                      value={value.email}
                      onChange={(e) => update({ email: e.target.value })}
                      maxLength={254}
                    />
                  </label>
                  <label>
                    Téléphone <span className="optional-label">Facultatif</span>
                    <input
                      type="tel"
                      autoComplete="off"
                      value={value.phone}
                      onChange={(e) => update({ phone: e.target.value })}
                      placeholder="+32 …"
                      maxLength={30}
                    />
                  </label>
                  <div className="participant-note">
                    <Icon name="users" />
                    <p>
                      {quantity > 1
                        ? `Cette sélection comprend ${quantity} participants. Les coordonnées ci-dessus désignent la personne de contact pour le groupe.`
                        : "Vous êtes la personne de contact pour cette sélection."}
                    </p>
                  </div>
                  <label className="demo-acknowledgement">
                    <input
                      type="checkbox"
                      required
                      checked={value.acknowledged}
                      onChange={(e) =>
                        update({ acknowledged: e.target.checked })
                      }
                    />
                    <span>
                      {activity.price === 0 ? "Je confirme ces coordonnées et souhaite réserver les places après vérification du récapitulatif. *" : activity.demonstration ? "J’ai compris que le parcours payant est une démonstration et ne réserve aucune place. *" : "Je confirme ces coordonnées et souhaite poursuivre vers le paiement sécurisé. L'inscription sera confirmée après validation du paiement. *"}
                    </span>
                  </label>
                  <button className="button coral flow-submit" type="submit">
                    {activity.price === 0
                      ? "Vérifier mon inscription"
                      : "Vérifier mon inscription"}
                    <Icon name="arrow" />
                  </button>
                </form>
              </>
            )}
          </div>
          <aside
            className="enrollment-card enrollment-recap"
            aria-label="Récapitulatif du prix"
          >
            <p className="eyebrow teal">VOTRE SÉLECTION</p>
            <h2>Récapitulatif</h2>
            <div className="recap-line">
              <span>
                {quantity} ×{" "}
                {activity.price === 0
                  ? "place gratuite"
                  : money(activity.price)}
              </span>
              <strong>
                {activity.price === 0
                  ? "Gratuit"
                  : money(quantity * activity.price)}
              </strong>
            </div>
            <div className="recap-total">
              <span>Total indicatif</span>
              <strong>
                {activity.price === 0
                  ? "0,00 €"
                  : money(quantity * activity.price)}
              </strong>
            </div>
            <div className="recap-note">
              <Icon name="ticket" />
              <p>
                {activity.price === 0
                  ? "Aucun moyen de paiement n’est nécessaire pour une activité gratuite."
                  : activity.demonstration ? "Aucun paiement n’est demandé à cette étape. Le paiement de démonstration sera proposé après vérification de vos informations." : "Aucun paiement n’est demandé à cette étape. Vous serez redirigé vers Stripe après vérification de vos informations."}
              </p>
            </div>
            <p className="recap-demo">
              {activity.demonstration ? "Tarifs et disponibilités de démonstration." : "Le montant et les places disponibles seront vérifiés avant l'ouverture du paiement."}
            </p>
            <hr />
            <h3>Organisé par</h3>
            <p>{activity.host}</p>
            <a href={`/activites/${activity.id}`} className="text-link">
              Revoir l’activité
              <Icon name="arrow" />
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
