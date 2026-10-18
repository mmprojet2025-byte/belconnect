import { useEffect, useRef, useState } from "react";
import type { Activity } from "../data/activities";
import type { EnrollmentDraft } from "../lib/booking";
import { bookingUrl, money } from "../lib/booking";
import { BookingSummary } from "../components/BookingSummary";
import { Icon } from "../components/Icon";
import "./Enrollment.css";
import "./PaymentPage.css";
export type PaymentAttempt = {
  outcome: "success" | "failure";
  method: "bancontact" | "card";
  quantity: number;
  draftKey: string;
};
import { paymentDraftKey } from "../lib/booking";
export function PaymentPage({
  activity,
  quantity,
  draft,
  step,
  attempt,
  onResult,
}: {
  activity: Activity;
  quantity: number;
  draft: EnrollmentDraft;
  step: string;
  attempt?: PaymentAttempt;
  onResult: (attempt: PaymentAttempt) => void;
}) {
  const [method, setMethod] = useState<"bancontact" | "card">(
    new URLSearchParams(window.location.search).get("methode") === "autre"
      ? attempt?.method === "card"
        ? "bancontact"
        : "card"
      : attempt?.method || "bancontact",
  );
  const [scenario, setScenario] = useState<"success" | "failure">("success");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const validAttempt =
    attempt?.quantity === quantity &&
    attempt.draftKey === paymentDraftKey(draft);
  const success =
    step === "confirmation" && validAttempt && attempt?.outcome === "success";
  const failed =
    step === "echec" && validAttempt && attempt?.outcome === "failure";
  function submit() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    timer.current = setTimeout(() => {
      onResult({
        outcome: scenario,
        method,
        quantity,
        draftKey: paymentDraftKey(draft),
      });
    }, 650);
  }
  const total = money(activity.price * quantity);
  return (
    <section className="enrollment-shell payment-shell">
      <div className="container enrollment-container">
        <a
          className="flow-back"
          href={bookingUrl(activity.id, "recapitulatif", quantity)}
        >
          <Icon name="arrow" className="reverse" />
          Retour au récapitulatif
        </a>
        <ol className="flow-steps" aria-label="Étapes de l’inscription">
          <li className="step-done">
            <span>✓</span>Connexion
          </li>
          <li className="step-done">
            <span>✓</span>Inscription
          </li>
          <li className="step-done">
            <span>✓</span>Récapitulatif
          </li>
          <li aria-current="step">
            <span>{success ? "✓" : "4"}</span>Paiement
          </li>
        </ol>
        <div className="enrollment-title">
          <p className="eyebrow teal">
            {success
              ? "VOTRE PROCHAINE DÉCOUVERTE"
              : failed
                ? "UN AUTRE ESSAI ?"
                : "DERNIÈRE ÉTAPE DU PARCOURS"}
          </p>
          <h1 tabIndex={-1}>
            {success
              ? "Paiement simulé réussi"
              : failed
                ? "Le paiement simulé a échoué"
                : "Finalisez votre inscription"}
          </h1>
          <p>
            {success
              ? "Votre parcours de démonstration est terminé."
              : failed
                ? "Votre sélection et vos coordonnées sont conservées pendant cette visite."
                : "Choisissez un moyen de paiement pour découvrir la dernière étape de la maquette."}
          </p>
        </div>
        <div className="enrollment-grid">
          <div className="enrollment-content">
            <BookingSummary activity={activity} quantity={quantity} />
            {success ? (
              <section className="enrollment-card payment-success">
                <span className="payment-state-icon">✓</span>
                <h2>Une belle découverte vous attend</h2>
                <p>
                  Voici le récapitulatif de votre inscription fictive. Aucun
                  débit ni réservation réelle n’a eu lieu.
                </p>
                <div className="demo-ticket">
                  <div className="ticket-top">
                    <Icon name="ticket" />
                    <strong>SPÉCIMEN · NON VALABLE À L’ENTRÉE</strong>
                  </div>
                  <h3>{activity.title}</h3>
                  <dl>
                    <div>
                      <dt>Participant principal</dt>
                      <dd>
                        {draft.firstName} {draft.lastName}
                      </dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{activity.date}</dd>
                    </div>
                    <div>
                      <dt>Participants</dt>
                      <dd>{quantity}</dd>
                    </div>
                    <div>
                      <dt>Moyen simulé</dt>
                      <dd>
                        {attempt?.method === "card"
                          ? "Carte bancaire"
                          : "Bancontact"}
                      </dd>
                    </div>
                    <div>
                      <dt>Total simulé</dt>
                      <dd>{total}</dd>
                    </div>
                  </dl>
                </div>
                <div className="demo-notice">
                  <strong>Aucun billet ni e-mail envoyé</strong>
                  <p>
                    Ce spécimen sert uniquement à visualiser le parcours. Il ne
                    donne accès à aucune activité.
                  </p>
                </div>
                <a className="button navy" href="/activites">
                  Découvrir d’autres activités
                  <Icon name="arrow" />
                </a>
              </section>
            ) : failed ? (
              <section className="enrollment-card payment-failure">
                <span className="payment-state-icon">!</span>
                <h2>Essayons à nouveau</h2>
                <p>
                  Vous avez choisi le scénario d’échec de la démonstration.
                  Aucun paiement n’a été envoyé à une banque.
                </p>
                <div className="inline-notice">
                  {quantity} participant{quantity > 1 ? "s" : ""} · {total} ·{" "}
                  {attempt?.method === "card" ? "Carte bancaire" : "Bancontact"}
                </div>
                <div className="failure-actions">
                  <a
                    className="button coral"
                    href={bookingUrl(activity.id, "paiement", quantity)}
                  >
                    Réessayer la simulation
                    <Icon name="arrow" />
                  </a>
                  <a
                    className="button outline"
                    href={
                      bookingUrl(activity.id, "paiement", quantity) +
                      "&methode=autre"
                    }
                  >
                    Changer de moyen de paiement
                  </a>
                  <a
                    className="text-link"
                    href={bookingUrl(activity.id, "inscription", quantity)}
                  >
                    Modifier mon inscription
                  </a>
                </div>
                <p className="auth-footnote">
                  Aucune place n’est bloquée par cette simulation.
                </p>
              </section>
            ) : (
              <form
                className="enrollment-card payment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                aria-busy={busy}
              >
                <h2>Votre moyen de paiement</h2>
                <p className="form-description">
                  Tout se déroule en mode démonstration. Aucune donnée bancaire
                  n’est demandée.
                </p>
                <fieldset disabled={busy} className="payment-methods">
                  <legend className="visually-hidden">
                    Choisir le moyen de paiement
                  </legend>
                  <label className={method === "bancontact" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="method"
                      checked={method === "bancontact"}
                      onChange={() => setMethod("bancontact")}
                    />
                    <span className="method-mark bancontact-mark">B</span>
                    <span>
                      <strong>Bancontact</strong>
                      <small>Découvrir le parcours belge</small>
                    </span>
                  </label>
                  <label className={method === "card" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="method"
                      checked={method === "card"}
                      onChange={() => setMethod("card")}
                    />
                    <span className="method-mark">
                      <Icon name="ticket" />
                    </span>
                    <span>
                      <strong>Carte bancaire</strong>
                      <small>Visa ou Mastercard · simulation</small>
                    </span>
                  </label>
                </fieldset>
                <div className="payment-method-preview">
                  <Icon name={method === "bancontact" ? "users" : "ticket"} />
                  <h3>
                    {method === "bancontact"
                      ? "Un aperçu du paiement Bancontact"
                      : "Un aperçu du paiement par carte"}
                  </h3>
                  <p>
                    {method === "bancontact"
                      ? "Dans la version connectée, cette étape utilisera le parcours du prestataire de paiement."
                      : "Dans la version connectée, les coordonnées de carte seront saisies auprès du prestataire de paiement."}
                  </p>
                  <span>Mode démo · Aucun paiement réel</span>
                </div>
                <fieldset className="payment-scenarios" disabled={busy}>
                  <legend>Tester un scénario</legend>
                  <label>
                    <input
                      type="radio"
                      name="scenario"
                      checked={scenario === "success"}
                      onChange={() => setScenario("success")}
                    />
                    Paiement réussi
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="scenario"
                      checked={scenario === "failure"}
                      onChange={() => setScenario("failure")}
                    />
                    Paiement refusé
                  </label>
                </fieldset>
                <button
                  className="button coral flow-submit"
                  disabled={busy}
                  type="submit"
                >
                  {busy
                    ? "Simulation en cours…"
                    : `Simuler le paiement de ${total}`}
                  <Icon name="arrow" />
                </button>
                <p className="payment-live" role="status">
                  {busy
                    ? "Préparation du résultat de démonstration…"
                    : "Aucun montant ne sera débité."}
                </p>
              </form>
            )}
          </div>
          <aside className="enrollment-card enrollment-recap payment-recap">
            <p className="eyebrow teal">VOTRE INSCRIPTION</p>
            <h2>Récapitulatif</h2>
            <div className="recap-line">
              <span>
                {quantity} × {money(activity.price)}
              </span>
              <strong>{total}</strong>
            </div>
            <div className="recap-total">
              <span>Total simulé</span>
              <strong>{total}</strong>
            </div>
            <p className="recap-demo">Tarif de démonstration.</p>
            <hr />
            <h3>Participant principal</h3>
            <p className="payment-contact">
              {draft.firstName} {draft.lastName}
              <br />
              {draft.email}
            </p>
            <a
              className="text-link"
              href={bookingUrl(activity.id, "inscription", quantity)}
            >
              Modifier les informations
              <Icon name="arrow" />
            </a>
            <div className="demo-notice">
              <strong>Une maquette interactive</strong>
              <p>
                Aucune transaction, réservation ou notification réelle. Les
                données disparaissent à l’actualisation.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
