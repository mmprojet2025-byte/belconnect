import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { tr, useLocale } from '../lib/locale';

type Notice = { id: number; title: string; createdAt: string };
type SpaceNotice = { id: number; requestId: number; name: string; event: 'DEMANDE_RECUE' | 'DEMANDE_APPROUVEE' | 'DEMANDE_REFUSEE'; createdAt: string };

export function AccountNotifications({ onOpenBookings, onOpenRequests, owner }: { onOpenBookings: () => void; onOpenRequests: () => void; owner: boolean }) {
  const locale = useLocale();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [spaceNotices, setSpaceNotices] = useState<SpaceNotice[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => Promise.all([
      owner ? Promise.resolve([] as Notice[]) : fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result) as Promise<Notice[]>,
      fetch('/api/workspace/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result) as Promise<SpaceNotice[]>,
    ])
      .then(([activity, spaces]) => { if (!controller.signal.aborted) { setNotices(activity); setSpaceNotices(spaces); setError(''); } })
      .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger vos nouvelles.'); });
    void load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [attempt, owner]);
  async function acknowledge(id: number, space = false) {
    setBusyId(id); setError('');
    try { await postJson(space ? `/api/workspace/notifications/${id}/read` : `/api/notifications/${id}/read`); if (space) setSpaceNotices(items => items.filter(item => item.id !== id)); else setNotices(items => items.filter(item => item.id !== id)); }
    catch { setError('Impossible de marquer cette nouvelle comme lue. Réessayez.'); }
    finally { setBusyId(null); }
  }
  return <section className="account-notifications" id="notifications" aria-label={tr(locale, 'Notifications', 'Notifications', 'Meldingen')}>
    <h2>{tr(locale, 'Notifications', 'Notifications', 'Meldingen')}{notices.length + spaceNotices.length > 0 && <span className="account-notification-count">{notices.length + spaceNotices.length}</span>}</h2>
    {!notices.length && !spaceNotices.length && !error && <p className="account-notice account-notice-empty">{tr(locale, 'Aucune nouvelle notification. Les demandes d’espace et leurs décisions apparaîtront ici.', 'No new notifications. Space requests and decisions will appear here.', 'Geen nieuwe meldingen. Aanvragen voor een ruimte en beslissingen verschijnen hier.')}</p>}
    {error && <p role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Réessayer</button></p>}
    {notices.map(notice => <div className="account-notice" key={notice.id}>
      <p><strong>{tr(locale, 'Activité annulée :', 'Activity cancelled:', 'Activiteit geannuleerd:')}</strong> {notice.title}</p>
      <div className="management-actions"><a className="text-link" href="#mes-inscriptions" onClick={onOpenBookings}>{tr(locale, 'Voir mon inscription', 'View my booking', 'Mijn inschrijving bekijken')}</a><button className="text-link" disabled={busyId !== null} onClick={() => acknowledge(notice.id)}>{busyId === notice.id ? tr(locale, 'Enregistrement…', 'Saving…', 'Opslaan…') : tr(locale, 'J’ai compris', 'Mark as read', 'Markeren als gelezen')}</button></div>
    </div>)}
    {spaceNotices.map(notice => <div className="account-notice" key={`space-${notice.id}`}>
      <p><strong>{notice.event === 'DEMANDE_RECUE' ? tr(locale, 'Nouvelle demande d’espace', 'New space request', 'Nieuwe aanvraag voor een ruimte') : notice.event === 'DEMANDE_APPROUVEE' ? tr(locale, 'Espace approuvé', 'Space approved', 'Ruimte goedgekeurd') : tr(locale, 'Demande d’espace refusée', 'Space request declined', 'Aanvraag voor ruimte geweigerd')} :</strong> {notice.name}</p>
      <div className="management-actions"><a className="text-link" href="#demandes" onClick={onOpenRequests}>{tr(locale, 'Voir la demande', 'View request', 'Aanvraag bekijken')}</a><button className="text-link" disabled={busyId !== null} onClick={() => acknowledge(notice.id, true)}>{busyId === notice.id ? tr(locale, 'Enregistrement…', 'Saving…', 'Opslaan…') : tr(locale, 'J’ai compris', 'Mark as read', 'Markeren als gelezen')}</button></div>
    </div>)}
  </section>;
}
