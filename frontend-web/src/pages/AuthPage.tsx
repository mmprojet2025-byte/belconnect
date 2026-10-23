import { AccountPage } from "./AccountPage";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Activity } from "../data/activities";
import { authenticate } from "../lib/auth";
import type { UserProfile } from "../lib/auth";
import { BookingSummary } from "../components/BookingSummary";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/navigation";
import { tr, useLocale } from "../lib/locale";
import "./Enrollment.css";
export function AuthPage({
  activity,
  quantity = 1,
  user,
  onComplete,
  onLogout,
}: {
  activity?: Activity;
  quantity?: number;
  user: UserProfile | null;
  onComplete: (profile: UserProfile) => void;
  onLogout: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const locale = useLocale();
  const t = (fr: string, en: string, nl: string) => tr(locale, fr, en, nl);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const confirmation = form.elements.namedItem(
      "confirmation",
    ) as HTMLInputElement | null;
    if (confirmation && data.get("password") !== data.get("confirmation")) {
      confirmation.setCustomValidity(t("Les mots de passe ne correspondent pas.", "Passwords do not match.", "De wachtwoorden komen niet overeen."));
      confirmation.reportValidity();
      return;
    }
    const password = String(data.get("password") || "");
    if (new TextEncoder().encode(password).length > 72) {
      setError(t("Le mot de passe dépasse 72 octets. Utilisez moins de caractères.", "The password exceeds 72 bytes. Use fewer characters.", "Het wachtwoord is langer dan 72 bytes. Gebruik minder tekens."));
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const profile = await authenticate(mode, {
        email: String(data.get("email")).trim(), password,
        ...(mode === "register" ? {
          firstName: String(data.get("firstName") || "").trim(),
          lastName: String(data.get("lastName") || "").trim(),
        } : {}),
      });
      form.reset();
      onComplete(profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Connexion impossible.", "Sign-in failed.", "Aanmelden mislukt."));
    } finally { locked.current = false; setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await onLogout(); }
    catch { setError(t("Déconnexion impossible. Réessayez lorsque le serveur est disponible.", "Could not sign out. Try again when the server is available.", "Afmelden mislukt. Probeer opnieuw wanneer de server beschikbaar is.")); }
    finally { setBusy(false); }
  }

  if (user && !activity) return <AccountPage key={user.id} user={user} onLogout={onLogout} onProfileSaved={onComplete} />;

  return (
    <section className="enrollment-shell auth-shell">
      <div className="container enrollment-container">
        <a
          className="flow-back"
          href={activity ? `/activites/${activity.id}` : "/"}
        >
          <Icon name="arrow" className="reverse" />
          {activity ? t("Retour à l’activité", "Back to activity", "Terug naar activiteit") : t("Retour à l’accueil", "Back to home", "Terug naar start")}
        </a>
        {activity && (
          <>
            <ol className="flow-steps" aria-label={t("Étapes de l’inscription", "Registration steps", "Inschrijvingsstappen")}>
              <li aria-current="step">
                <span>1</span>{t("Connexion", "Sign in", "Aanmelden")}
              </li>
              <li>
                <span>2</span>{t("Inscription", "Registration", "Inschrijving")}
              </li>
              <li>
                <span>3</span>{t("Récapitulatif", "Summary", "Overzicht")}
              </li>
              {activity && activity.price > 0 && (
                <li>
                  <span>4</span>{t("Paiement", "Payment", "Betaling")}
                </li>
              )}
            </ol>
            <BookingSummary activity={activity} quantity={quantity} compact />
          </>
        )}
        <div className="auth-card">
          <span className="auth-emblem">
            <Icon name="users" />
          </span>
          <p className="eyebrow teal">{t("LES RENCONTRES COMMENCENT ICI", "CONNECTIONS START HERE", "ONTMOETINGEN BEGINNEN HIER")}</p>
          <h1 tabIndex={-1}>
            {user
              ? t("Votre espace Belconnect", "Your Belconnect space", "Uw Belconnect-ruimte")
              : mode === "login"
                ? t("Heureux de vous retrouver", "Welcome back", "Welkom terug")
                : t("Bienvenue chez Belconnect", "Welcome to Belconnect", "Welkom bij Belconnect")}
          </h1>
          <p className="auth-intro">
            {user
              ? t("Vous êtes connecté à votre compte.", "You are signed in.", "U bent aangemeld.")
              : activity
                ? t("Connectez-vous pour poursuivre votre inscription.", "Sign in to continue your registration.", "Meld u aan om uw inschrijving voort te zetten.")
                : t("Un compte pour vos activités et vos prochaines découvertes.", "One account for your activities and new discoveries.", "Eén account voor uw activiteiten en nieuwe ontdekkingen.")}
          </p>
          {activity && <p className="inline-notice">{t("Compte Belconnect", "Belconnect account", "Belconnect-account")} · {activity.price === 0 ? t("votre réservation gratuite sera enregistrée", "your free booking will be saved", "uw gratis reservering wordt opgeslagen") : activity.demonstration ? t("ce paiement est une démonstration, sans réservation", "this is a demo payment, with no booking", "dit is een demobetaling, zonder reservering") : t("votre inscription sera confirmée après validation du paiement Stripe", "your registration will be confirmed after the Stripe payment", "uw inschrijving wordt bevestigd na de Stripe-betaling")}.</p>}
          {new URLSearchParams(window.location.search).get('motDePasse') === 'reinitialise' && <p className="inline-notice" role="status">{t("Votre mot de passe a été modifié. Connectez-vous avec le nouveau mot de passe.", "Your password has been changed. Sign in with your new password.", "Uw wachtwoord is gewijzigd. Meld u aan met uw nieuwe wachtwoord.")}</p>}
          {error && <p className="inline-notice" role="alert">{error}</p>}
          {user ? (
            <div className="demo-account">
              <p>
                {user.firstName || t("Mon compte", "My account", "Mijn account")} {user.lastName}
              </p>
              <p>{user.email}</p>
              {activity ? (
                <button
                  className="button coral"
                  onClick={() => onComplete(user)}
                >
                  {t("Continuer mon inscription", "Continue registration", "Inschrijving voortzetten")}
                  <Icon name="arrow" />
                </button>
              ) : (
                <a className="button coral" href="/activites">
                  {t("Explorer les activités", "Explore activities", "Activiteiten ontdekken")}
                  <Icon name="arrow" />
                </a>
              )}
              <button className="text-link" disabled={busy} onClick={logout}>
                {t("Se déconnecter", "Sign out", "Afmelden")}
              </button>
            </div>
          ) : (
            <>
              <div className="auth-switch" aria-label={t("Choisir le formulaire", "Choose a form", "Kies een formulier")}>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "login"}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  {t("Se connecter", "Sign in", "Aanmelden")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "register"}
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                >
                  {t("Créer un compte", "Create account", "Account aanmaken")}
                </button>
              </div>
              <form key={mode} className="flow-form" onSubmit={submit}>
                {mode === "register" && (
                  <div className="form-pair">
                    <label>
                      {t("Prénom", "First name", "Voornaam")}
                      <input
                        name="firstName"
                        required
                        pattern=".*\S.*"
                        autoComplete="on"
                        placeholder="Camille"
                        maxLength={80}
                      />
                    </label>
                    <label>
                      {t("Nom", "Last name", "Achternaam")}
                      <input
                        name="lastName"
                        required
                        pattern=".*\S.*"
                        autoComplete="on"
                        placeholder="Martin"
                        maxLength={80}
                      />
                    </label>
                  </div>
                )}
                <label>
                  {t("Adresse e-mail", "Email address", "E-mailadres")}
                  <input
                    name="email"
                    type="email"
                    autoComplete="on"
                    required
                    placeholder="camille@example.com"
                    maxLength={254}
                  />
                </label>
                <label htmlFor="auth-password">
                  {t("Mot de passe", "Password", "Wachtwoord")}
                </label>
                <div className="password-input">
                  <input
                    id="auth-password"
                    onInput={(event) => {
                      const confirmation =
                        event.currentTarget.form?.elements.namedItem(
                          "confirmation",
                        ) as HTMLInputElement | null;
                      confirmation?.setCustomValidity("");
                    }}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "register" ? 12 : 1}
                    maxLength={72}
                    placeholder={mode === "register" ? t("12 caractères minimum", "At least 12 characters", "Minstens 12 tekens") : t("Votre mot de passe", "Your password", "Uw wachtwoord")}
                    aria-describedby="password-help"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? t("Masquer le mot de passe", "Hide password", "Wachtwoord verbergen")
                        : t("Afficher le mot de passe", "Show password", "Wachtwoord tonen")
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? t("Masquer", "Hide", "Verbergen") : t("Afficher", "Show", "Tonen")}
                  </button>
                </div>
                <p id="password-help" className="field-help">
                  {t("Pour créer un compte : 12 caractères minimum, 72 octets maximum.", "To create an account: at least 12 characters, up to 72 bytes.", "Om een account aan te maken: minstens 12 tekens, maximaal 72 bytes.")}
                </p>
                {mode === "register" && (
                  <label>
                    {t("Confirmer le mot de passe", "Confirm password", "Wachtwoord bevestigen")}
                    <input
                      name="confirmation"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={mode === "register" ? 12 : 1}
                      maxLength={72}
                      onInput={(event) =>
                        event.currentTarget.setCustomValidity("")
                      }
                    />
                  </label>
                )}
                {mode === "login" && <button className="forgot-password" type="button" onClick={() => navigate('/reinitialiser-mot-de-passe')}>{t("Mot de passe oublié ?", "Forgot password?", "Wachtwoord vergeten?")}</button>}
                <button className="button coral flow-submit" type="submit" disabled={busy} aria-busy={busy}>
                  {mode === "login"
                    ? t("Se connecter et continuer", "Sign in and continue", "Aanmelden en doorgaan")
                    : t("Créer mon compte et continuer", "Create account and continue", "Account aanmaken en doorgaan")}
                  <Icon name="arrow" />
                </button>
              </form>
              <p className="auth-footnote">
                {t("Votre session est conservée après actualisation. La vérification de l’adresse e-mail n’est pas encore disponible.", "Your session remains active after refreshing. Email verification is not yet available.", "Uw sessie blijft actief na vernieuwen. E-mailverificatie is nog niet beschikbaar.")}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
