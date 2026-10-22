import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { tr, useLocale } from '../lib/locale';

type Notice = { id: number; title: string; createdAt: string };
type SpaceNotice = { id: number; requestId: number; name: string; event: 'DEMANDE_RECUE' | 'DEMANDE_APPROUVEE' | 'DEMANDE_REFUSEE'; createdAt: string };
type GroupNotice = { id: number; requestId: number; spaceId: number; groupName: string; event: 'DEMANDE_RECUE' | 'DEMANDE_ACCEPTEE' | 'DEMANDE_REFUSEE'; createdAt: string };

export function AccountNotifications({ onOpenBookings, onOpenRequests, owner }: { onOpenBookings: () => void; onOpenRequests: () => void; owner: boolean }) {
  const locale = useLocale();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [spaceNotices, setSpaceNotices] = useState<SpaceNotice[]>([]);
  const [groupNotices, setGroupNotices] = useState<GroupNotice[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => Promise.all([
      owner ? Promise.resolve([] as Notice[]) : fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result) as Promise<Notice[]>,
      fetch('/api/workspace/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result) as Promise<SpaceNotice[]>,
      owner ? Promise.resolve([] as GroupNotice[]) : fetch('/api/group-memberships/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result) as Promise<GroupNotice[]>,
    ])
      .then(([activity, spaces, groups]) => { if (!controller.signal.aborted) { setNotices(activity); setSpaceNotices(spaces); setGroupNotices(groups); setError(''); window.dispatchEvent(new CustomEvent('belconnect:notification-count', { detail: activity.length + spaces.length + groups.length })); } })
      .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger vos nouvelles.'); });
    void load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [attempt, owner]);
  async function acknowledge(id: number, kind: 'activity' | 'space' | 'group' = 'activity') {
    setBusyId(id); setError('');
    try { await postJson(kind === 'space' ? `/api/workspace/notifications/${id}/read` : kind === 'group' ? `/api/group-memberships/notifications/${id}/read` : `/api/notifications/${id}/read`); if (kind === 'space') setSpaceNotices(items => items.filter(item => item.id !== id)); else if (kind === 'group') setGroupNotices(items => items.filter(item => item.id !== id)); else setNotices(items => items.filter(item => item.id !== id)); window.dispatchEvent(new Event('belconnect:notifications-changed')); }
    catch { setError('Impossible de marquer cette nouvelle comme lue. Réessayez.'); }
    finally { setBusyId(null); }
  }
  return <section className="account-notifications" id="notifications" aria-label={tr(locale, 'Notifications', 'Notifications', 'Meldingen')}>
    <h2>{tr(locale, 'Notifications', 'Notifications', 'Meldingen')}{notices.length + spaceNotices.length + groupNotices.length > 0 && <span className="account-notification-count">{notices.length + spaceNotices.length + groupNotices.length}</span>}</h2>
    {!notices.length && !spaceNotices.length && !groupNotices.length && !error && <p className="account-notice account-notice-empty">Aucune nouvelle notification. Les demandes d’adhésion, demandes d’espace et décisions apparaîtront ici.</p>}
    {error && <p role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Réessayer</button></p>}
    {notices.map(notice => <div className="account-notice" key={notice.id}>
      <p><strong>{tr(locale, 'Activité annulée :', 'Activity cancelled:', 'Activiteit geannuleerd:')}</strong> {notice.title}</p>
      <div className="management-actions"><a className="text-link" href="#mes-inscriptions" onClick={onOpenBookings}>{tr(locale, 'Voir mon inscription', 'View my booking', 'Mijn inschrijving bekijken')}</a><button className="text-link" disabled={busyId !== null} onClick={() => acknowledge(notice.id)}>{busyId === notice.id ? tr(locale, 'Enregistrement…', 'Saving…', 'Opslaan…') : tr(locale, 'J’ai compris', 'Mark as read', 'Markeren als gelezen')}</button></div>
    </div>)}
    {spaceNotices.map(notice => <div className="account-notice" key={`space-${notice.id}`}>
      <p><strong>{notice.event === 'DEMANDE_RECUE' ? tr(locale, 'Nouvelle demande d’espace', 'New space request', 'Nieuwe aanvraag voor een ruimte') : notice.event === 'DEMANDE_APPROUVEE' ? tr(locale, 'Espace approuvé', 'Space approved', 'Ruimte goedgekeurd') : tr(locale, 'Demande d’espace refusée', 'Space request declined', 'Aanvraag voor ruimte geweigerd')} :</strong> {notice.name}</p>
      <div className="management-actions"><a className="text-link" href={owner ? '#a-traiter' : '#demandes'} onClick={onOpenRequests}>{tr(locale, 'Voir la demande', 'View request', 'Aanvraag bekijken')}</a><button className="text-link" disabled={busyId !== null} onClick={() => acknowledge(notice.id, 'space')}>{busyId === notice.id ? tr(locale, 'Enregistrement…', 'Saving…', 'Opslaan…') : tr(locale, 'J’ai compris', 'Mark as read', 'Markeren als gelezen')}</button></div>
    </div>)}
    {groupNotices.map(notice => <div className="account-notice" key={`group-${notice.id}`}>
      <p><strong>{notice.event === 'DEMANDE_RECUE' ? 'Nouvelle demande d’adhésion' : notice.event === 'DEMANDE_ACCEPTEE' ? 'Adhésion acceptée' : 'Adhésion refusée'} :</strong> {notice.groupName}</p>
      <div className="management-actions"><a className="text-link" href={notice.event === 'DEMANDE_RECUE' ? `/mon-espace?espace=${notice.spaceId}&rubrique=adhesions#organisation` : '/mon-espace#demandes'}>{notice.event === 'DEMANDE_RECUE' ? 'Examiner la demande' : 'Voir ma demande'}</a><button className="text-link" disabled={busyId !== null} onClick={() => acknowledge(notice.id, 'group')}>{busyId === notice.id ? 'Enregistrement…' : 'J’ai compris'}</button></div>
    </div>)}
  </section>;
}
