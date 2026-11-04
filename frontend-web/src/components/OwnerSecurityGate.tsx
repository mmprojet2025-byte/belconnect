import { OwnerReverification } from "./OwnerReverification";
import { useEffect, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { postJson, result } from '../lib/auth';
import './OwnerSecurityGate.css';

type Status = { owner: boolean; enabled: boolean; verified: boolean };
export function OwnerSecurityGate({ children, manage = false, onLogout }: { children?: ReactNode; manage?: boolean; onLogout?: () => Promise<void> }) {
  const [reverify, setReverify] = useState(false);
  useEffect(() => { if (manage) return; const requireCode = () => setReverify(true); window.addEventListener('owner-reverify-required', requireCode); return () => window.removeEventListener('owner-reverify-required', requireCode); }, [manage]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [recovery, setRecovery] = useState(false);
  const [replace, setReplace] = useState(false);
  const [saved, setSaved] = useState(false);
  async function refresh() {
    const value: Status = await fetch('/api/auth/owner-mfa/status', { credentials: 'same-origin', cache: 'no-store' }).then(result);
    setStatus(value);
  }
  useEffect(() => { const controller = new AbortController(); fetch('/api/auth/owner-mfa/status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(result).then(setStatus).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form); setBusy(true); setError('');
    try {
      if (secret) {
        const response = await postJson('/api/auth/owner-mfa/confirm', { code: String(data.get('code')) });
        setCodes(response.recoveryCodes); setSecret(''); setReplace(false); setSaved(false);
      } else if (!status?.enabled || replace) {
        const response = await postJson('/api/auth/owner-mfa/begin', { password: String(data.get('password')) });
        setSecret(response.secret);
      } else {
        await postJson('/api/auth/owner-mfa/verify', { code: String(data.get('code')), recovery });
        await refresh(); setReverify(false);
      }
      form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Vérification impossible. Réessayez.'); }
    finally { setBusy(false); }
  }
  if (status && !status.owner) return <>{children}</>;
  if (status?.verified && !manage && !codes.length) return <>{children}{reverify && <OwnerReverification onClose={() => setReverify(false)} />}</>;
  return <section className="owner-security" aria-labelledby={manage ? 'owner-security-settings' : 'owner-security-title'}>
    <h2 id={manage ? 'owner-security-settings' : 'owner-security-title'}>Sécurité du compte propriétaire</h2>
    {!status ? <><p>Vérification de la protection du compte…</p>{error && <><p role="alert">{error}</p><button onClick={() => { setError(''); void refresh().catch(cause => setError(cause.message)); }}>Réessayer</button></>}</> : codes.length ? <>
      <h3>Conservez vos codes de récupération</h3><p>Ces dix codes ne seront affichés qu’une fois. Chaque code remplace le code de votre application pour une seule connexion. Gardez-les dans un gestionnaire de mots de passe ou dans un endroit sûr, séparé de votre téléphone. Ne les partagez pas.</p>
      <ul className="owner-security-codes">{codes.map(code => <li key={code}><code>{code}</code></li>)}</ul>
      <label><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /> J’ai conservé mes codes dans un endroit sûr.</label>
      <button className="button" disabled={!saved || busy} onClick={() => { setCodes([]); void refresh().catch(cause => setError(cause.message)); }}>Continuer</button>
    </> : status.verified && manage && !replace && !secret ? <>
      <p>La double authentification est active. Votre session propriétaire expire après quinze minutes d’inactivité.</p>
      <p>Pour changer de téléphone ou renouveler vos codes de récupération, configurez une nouvelle clé. L’ancienne protection reste active jusqu’à la confirmation de la nouvelle.</p>
      <button className="button outline" onClick={() => setReplace(true)}>Remplacer mon application et mes codes</button>
    </> : <>
      <p>{reverify ? "Cette action sensible demande une confirmation récente. Saisissez le nouveau code de votre application, puis relancez l’action : elle n’a pas encore été effectuée." : "Le mot de passe seul ne suffit pas à ouvrir les outils du propriétaire."}</p>
      <form onSubmit={submit} key={secret ? 'confirm' : replace || !status.enabled ? 'begin' : recovery ? 'recovery' : 'verify'}>
        {secret ? <>
          <h3>Ajoutez BelConnect à votre application d’authentification</h3>
          <p>Dans votre application, choisissez l’ajout manuel d’un compte, indiquez « BelConnect propriétaire », puis saisissez la clé ci-dessous. Choisissez un code basé sur le temps, à six chiffres. Ne partagez pas cette clé.</p>
          <code className="owner-security-secret">{secret}</code>
          <label>Code à six chiffres de l’application<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label>
          <button className="button" disabled={busy}>Confirmer l’activation</button>
        </> : !status.enabled || replace ? <>
          <h3>{replace ? 'Configurer une nouvelle application' : 'Activer la double authentification'}</h3>
          <p>Préparez une application d’authentification sur votre téléphone. Vous recevrez ensuite des codes de récupération pour retrouver votre accès si vous perdez ce téléphone.</p>
          <label>Confirmez votre mot de passe<input type="password" name="password" maxLength={72} autoComplete="current-password" required /></label>
          <button className="button" disabled={busy}>Préparer la configuration</button>
        </> : <>
          <label>{recovery ? 'Un code de récupération' : 'Code à six chiffres de l’application'}<input name="code" inputMode={recovery ? 'text' : 'numeric'} pattern={recovery ? '[A-Fa-f0-9]{32}' : '[0-9]{6}'} maxLength={recovery ? 32 : 6} autoComplete={recovery ? 'off' : 'one-time-code'} required /></label>
          <button className="button" disabled={busy}>Vérifier et ouvrir mon compte</button>
          <button type="button" className="text-link" disabled={busy} onClick={() => { setRecovery(!recovery); setError(''); }}>{recovery ? 'Utiliser mon application' : 'J’ai perdu mon téléphone : utiliser un code de récupération'}</button>
        </>}
      </form>
    </>}
    {manage && status?.verified && !replace && !secret && !codes.length && <p><a href="/mon-espace#securite">Ouvrir le journal de sécurité →</a></p>}
    {status && error && <p role="alert">{error}</p>}
    {onLogout && <button className="text-link" disabled={busy} onClick={() => void onLogout().catch(cause => setError(cause.message))}>Se déconnecter</button>}
  </section>;
}
