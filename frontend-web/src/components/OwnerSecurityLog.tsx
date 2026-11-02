import { OwnerSessions } from "./OwnerSessions";
import { OwnerActionLog } from "./OwnerActionLog";
import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Entry = { id: number; action: string; at: string };
type Page = { items: Entry[]; hasMore: boolean };
const labels: Record<string, string> = { ACTIVATION: 'Application et codes de secours configurés', VERIFICATION: 'Code de l’application validé', RECUPERATION: 'Code de récupération utilisé', ECHEC: 'Tentative de vérification refusée', CONNEXION_REFUSEE: 'Mot de passe refusé pour ce compte', MOT_DE_PASSE_VALIDE: 'Mot de passe validé — second facteur encore requis', DECONNEXION: 'Déconnexion volontaire', MOT_DE_PASSE_REINITIALISE: 'Mot de passe réinitialisé', SESSION_REVOQUEE: 'Une autre session révoquée', AUTRES_SESSIONS_REVOQUEES: 'Les autres sessions révoquées' };
export function OwnerSecurityLog() {
  const [tab, setTab] = useState<'access' | 'actions' | 'sessions'>('access');
  const [items, setItems] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    fetch('/api/auth/owner-mfa/events', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(result).then((page: Page) => { setItems(page.items); setMore(page.hasMore); }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [revision]);
  async function older() {
    if (busy || !items.length) return; setBusy(true); setError('');
    try {
      const page: Page = await fetch(`/api/auth/owner-mfa/events?before=${items[items.length - 1].id}`, { credentials: 'same-origin', cache: 'no-store' }).then(result);
      setItems(old => [...old, ...page.items]); setMore(page.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Journal indisponible.'); }
    finally { setBusy(false); }
  }
  return <section className="owner-security-log" aria-labelledby="security-log-title" aria-busy={busy}>
    <div className="account-section-heading"><h3 id="security-log-title">Journal de sécurité</h3><button className="button outline" disabled={busy} onClick={() => setRevision(value => value + 1)}>Actualiser</button></div>
    <nav className="workspace-context-nav" aria-label="Rubriques du journal"><button aria-current={tab === 'access' ? 'page' : undefined} onClick={() => setTab('access')}>Connexions et protection</button><button aria-current={tab === 'actions' ? 'page' : undefined} onClick={() => setTab('actions')}>Actions sensibles</button><button aria-current={tab === 'sessions' ? 'page' : undefined} onClick={() => setTab('sessions')}>Sessions ouvertes</button></nav>
    {tab === 'sessions' ? <OwnerSessions /> : tab === 'actions' ? <OwnerActionLog /> : <>
    <p>Accès et protection de votre compte, du plus récent au plus ancien. Les connexions par mot de passe et les déconnexions sont enregistrées à partir de cette mise à jour. Une tentative refusée ne permet pas d’identifier la personne qui l’a faite. Les heures sont celles de votre appareil.</p>
    {error && <p role="alert">{error}</p>}
    {!items.length && !busy && !error && <p>Aucun événement enregistré pour votre compte.</p>}
    {busy && !items.length && <p role="status">Chargement du journal…</p>}
    <ol>{items.map(item => <li key={item.id}><div><strong>{labels[item.action] ?? 'Événement de sécurité'}</strong><time dateTime={item.at}>{new Date(item.at).toLocaleString('fr-BE')}</time></div><span className={['ECHEC', 'CONNEXION_REFUSEE'].includes(item.action) ? 'security-event-failed' : 'security-event-success'}>{['ECHEC', 'CONNEXION_REFUSEE'].includes(item.action) ? 'Refusé' : 'Réussi'}</span></li>)}</ol>
    {more && <button className="button outline" disabled={busy} onClick={() => void older()}>{busy ? 'Chargement…' : 'Voir les événements précédents'}</button>}
    </>}
  </section>;
}
