import { useState } from 'react';
import type { FormEvent } from 'react';
import { postJson } from '../lib/auth';
import { Icon } from '../components/Icon';
import { tr, useLocale } from '../lib/locale';
import './Enrollment.css';

export function PasswordRecoveryPage() {
  const locale = useLocale();
  const t = (fr: string, en: string, nl: string) => tr(locale, fr, en, nl);
  const token = new URLSearchParams(window.location.hash.slice(1)).get('jeton');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password') || '');
    if (token && password !== String(fields.get('confirmation') || '')) {
      setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.', 'De wachtwoorden komen niet overeen.'));
      return;
    }
    if (token && new TextEncoder().encode(password).length > 72) {
      setError(t('Le mot de passe dépasse 72 octets. Utilisez moins de caractères.', 'The password exceeds 72 bytes. Use fewer characters.', 'Het wachtwoord is langer dan 72 bytes. Gebruik minder tekens.'));
      return;
    }
    setBusy(true); setError('');
    try {
      if (token) {
        await postJson('/api/auth/password/reset', { token, password });
        window.location.assign('/connexion?motDePasse=reinitialise');
      } else {
        await postJson('/api/auth/password/recovery', { email: String(fields.get('email') || '').trim() });
        setSent(true);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('La demande a échoué. Réessayez.', 'The request failed. Try again.', 'De aanvraag is mislukt. Probeer opnieuw.')); }
    finally { setBusy(false); }
  }

  return <section className="enrollment-shell auth-shell"><div className="container enrollment-container">
    <a className="flow-back" href="/connexion"><Icon name="arrow" className="reverse" /> {t('Retour à la connexion', 'Back to sign in', 'Terug naar aanmelden')}</a>
    <div className="auth-card">
      <span className="auth-emblem"><Icon name="users" /></span>
      <p className="eyebrow teal">{t('VOTRE COMPTE BELCONNECT', 'YOUR BELCONNECT ACCOUNT', 'UW BELCONNECT-ACCOUNT')}</p>
      <h1 tabIndex={-1}>{token ? t('Choisir un nouveau mot de passe', 'Choose a new password', 'Kies een nieuw wachtwoord') : t('Mot de passe oublié ?', 'Forgot password?', 'Wachtwoord vergeten?')}</h1>
      <p className="auth-intro">{token ? t('Ce lien est valable 30 minutes et ne peut être utilisé qu’une fois.', 'This link is valid for 30 minutes and can only be used once.', 'Deze link is 30 minuten geldig en kan slechts één keer worden gebruikt.') : t('Saisissez l’adresse e-mail de votre compte. Si elle existe, vous recevrez un lien valable 30 minutes.', 'Enter your account email address. If it exists, you will receive a link valid for 30 minutes.', 'Voer het e-mailadres van uw account in. Als het bestaat, ontvangt u een link die 30 minuten geldig is.')}</p>
      {sent ? <p className="inline-notice" role="status">{t('Si un compte actif utilise cette adresse et que l’envoi aboutit, vous recevrez un lien de réinitialisation. Vérifiez aussi vos courriers indésirables.', 'If an active account uses this address and delivery succeeds, you will receive a reset link. Also check your spam folder.', 'Als een actief account dit adres gebruikt en de verzending lukt, ontvangt u een herstellink. Controleer ook uw spammap.')}</p> :
        <form className="flow-form" onSubmit={submit}>
          {token ? <>
            <label>{t('Nouveau mot de passe', 'New password', 'Nieuw wachtwoord')}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <label>{t('Confirmer le mot de passe', 'Confirm password', 'Wachtwoord bevestigen')}<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <p className="field-help">{t('12 caractères minimum, 72 octets maximum.', 'At least 12 characters, up to 72 bytes.', 'Minstens 12 tekens, maximaal 72 bytes.')}</p>
          </> : <label>{t('Adresse e-mail', 'Email address', 'E-mailadres')}<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
          {error && <p className="inline-notice" role="alert">{error}</p>}
          <button className="button coral flow-submit" disabled={busy}>{busy ? t('Envoi…', 'Sending…', 'Verzenden…') : token ? t('Enregistrer mon nouveau mot de passe', 'Save my new password', 'Mijn nieuwe wachtwoord opslaan') : t('Recevoir le lien', 'Send me the link', 'Stuur mij de link')} <Icon name="arrow" /></button>
        </form>}
    </div>
  </div></section>;
}
