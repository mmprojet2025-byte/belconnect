import { AccountPage } from "./AccountPage";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Activity } from "../data/activities";
import { authenticate } from "../lib/auth";
import type { UserProfile } from "../lib/auth";
import { BookingSummary } from "../components/BookingSummary";
import { Icon } from "../components/Icon";
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
  const [showPassword, setShowPassword] = useState(false);
  const [help, setHelp] = useState(false);
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
      confirmation.setCustomValidity("Les mots de passe ne correspondent pas.");
      confirmation.reportValidity();
      return;
    }
    const password = String(data.get("password") || "");
    if (new TextEncoder().encode(password).length > 72) {
      setError("Le mot de passe dépasse 72 octets. Utilisez moins de caractères.");
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
      setError(cause instanceof Error ? cause.message : "Connexion impossible.");
    } finally { locked.current = false; setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await onLogout(); }
    catch { setError("Déconnexion impossible. Réessayez lorsque le serveur est disponible."); }
    finally { setBusy(false); }
  }

  if (user && !activity) return <AccountPage user={user} onLogout={onLogout} onProfileSaved={onComplete} />;

  return (
    <section className="enrollment-shell auth-shell">
      <div className="container enrollment-container">
        <a
          className="flow-back"
          href={activity ? `/activites/${activity.id}` : "/"}
        >
          <Icon name="arrow" className="reverse" />
          {activity ? "Retour à l’activité" : "Retour à l’accueil"}
        </a>
        {activity && (
          <>
            <ol className="flow-steps" aria-label="Étapes de l’inscription">
              <li aria-current="step">
                <span>1</span>Connexion
              </li>
              <li>
                <span>2</span>Inscription
              </li>
              <li>
                <span>3</span>Récapitulatif
              </li>
              {activity && activity.price > 0 && (
                <li>
                  <span>4</span>Paiement
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
          <p className="eyebrow teal">LES RENCONTRES COMMENCENT ICI</p>
          <h1 tabIndex={-1}>
            {user
              ? "Votre espace Belconnect"
              : mode === "login"
                ? "Heureux de vous retrouver"
                : "Bienvenue chez Belconnect"}
          </h1>
          <p className="auth-intro">
            {user
              ? "Vous êtes connecté à votre compte."
              : activity
                ? "Connectez-vous pour poursuivre votre inscription."
                : "Un compte pour vos activités et vos prochaines découvertes."}
          </p>
          {activity && <p className="inline-notice">Compte Belconnect · {activity.price === 0 ? "votre réservation gratuite sera enregistrée" : activity.demonstration ? "ce paiement est une démonstration, sans réservation" : "votre inscription sera confirmée après validation du paiement Stripe"}.</p>}
          {error && <p className="inline-notice" role="alert">{error}</p>}
          {user ? (
            <div className="demo-account">
              <p>
                {user.firstName || "Mon compte"} {user.lastName}
              </p>
              <p>{user.email}</p>
              {activity ? (
                <button
                  className="button coral"
                  onClick={() => onComplete(user)}
                >
                  Continuer mon inscription
                  <Icon name="arrow" />
                </button>
              ) : (
                <a className="button coral" href="/activites">
                  Explorer les activités
                  <Icon name="arrow" />
                </a>
              )}
              <button className="text-link" disabled={busy} onClick={logout}>
                Se déconnecter
              </button>
            </div>
          ) : (
            <>
              <div className="auth-switch" aria-label="Choisir le formulaire">
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "login"}
                  onClick={() => {
                    setMode("login");
                    setHelp(false); setError("");
                  }}
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "register"}
                  onClick={() => {
                    setMode("register");
                    setHelp(false); setError("");
                  }}
                >
                  Créer un compte
                </button>
              </div>
              <form key={mode} className="flow-form" onSubmit={submit}>
                {mode === "register" && (
                  <div className="form-pair">
                    <label>
                      Prénom
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
                      Nom
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
                  Adresse e-mail
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
                  Mot de passe
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
                    placeholder={mode === "register" ? "12 caractères minimum" : "Votre mot de passe"}
                    aria-describedby="password-help"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <p id="password-help" className="field-help">
                  Pour créer un compte : 12 caractères minimum, 72 octets maximum.
                </p>
                {mode === "register" && (
                  <label>
                    Confirmer le mot de passe
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
                {mode === "login" && (
                  <button
                    className="forgot-password"
                    type="button"
                    onClick={() => setHelp(!help)}
                    aria-expanded={help}
                  >
                    Mot de passe oublié ?
                  </button>
                )}
                {help && (
                  <p className="inline-notice" role="status">
                    La réinitialisation par e-mail n’est pas encore disponible.
                  </p>
                )}
                <button className="button coral flow-submit" type="submit" disabled={busy} aria-busy={busy}>
                  {mode === "login"
                    ? "Se connecter et continuer"
                    : "Créer mon compte et continuer"}
                  <Icon name="arrow" />
                </button>
              </form>
              <p className="auth-footnote">
                Votre session est conservée après actualisation. La vérification de l’adresse e-mail n’est pas encore disponible.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
