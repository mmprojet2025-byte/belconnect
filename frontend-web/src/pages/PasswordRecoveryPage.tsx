import { useState } from 'react';
import type { FormEvent } from 'react';
import { postJson } from '../lib/auth';
import { Icon } from '../components/Icon';
import './Enrollment.css';

export function PasswordRecoveryPage() {
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
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (token && new TextEncoder().encode(password).length > 72) {
      setError('Le mot de passe dépasse 72 octets. Utilisez moins de caractères.');
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'La demande a échoué. Réessayez.'); }
    finally { setBusy(false); }
  }

  return <section className="enrollment-shell auth-shell"><div className="container enrollment-container">
    <a className="flow-back" href="/connexion"><Icon name="arrow" className="reverse" /> Retour à la connexion</a>
    <div className="auth-card">
      <span className="auth-emblem"><Icon name="users" /></span>
      <p className="eyebrow teal">VOTRE COMPTE BELCONNECT</p>
      <h1 tabIndex={-1}>{token ? 'Choisir un nouveau mot de passe' : 'Mot de passe oublié ?'}</h1>
      <p className="auth-intro">{token ? 'Ce lien est valable 30 minutes et ne peut être utilisé qu’une fois.' : 'Saisissez l’adresse e-mail de votre compte. Si elle existe, vous recevrez un lien valable 30 minutes.'}</p>
      {sent ? <p className="inline-notice" role="status">Si un compte actif utilise cette adresse et que l’envoi aboutit, vous recevrez un lien de réinitialisation. Vérifiez aussi vos courriers indésirables.</p> :
        <form className="flow-form" onSubmit={submit}>
          {token ? <>
            <label>Nouveau mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <label>Confirmer le mot de passe<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></label>
            <p className="field-help">12 caractères minimum, 72 octets maximum.</p>
          </> : <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
          {error && <p className="inline-notice" role="alert">{error}</p>}
          <button className="button coral flow-submit" disabled={busy}>{busy ? 'Envoi…' : token ? 'Enregistrer mon nouveau mot de passe' : 'Recevoir le lien'} <Icon name="arrow" /></button>
        </form>}
    </div>
  </div></section>;
}
