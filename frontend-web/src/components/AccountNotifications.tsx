import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { navigate } from '../lib/navigation';
import { tr, useLocale } from '../lib/locale';

type ActivityNotice = { kind: 'activity'; id: number; title: string; createdAt: string };
type SpaceNotice = { kind: 'space'; id: number; requestId: number; name: string; event: 'DEMANDE_RECUE' | 'DEMANDE_APPROUVEE' | 'DEMANDE_REFUSEE'; createdAt: string };
type GroupNotice = { kind: 'group'; id: number; requestId: number; spaceId: number; groupName: string; event: 'DEMANDE_RECUE' | 'DEMANDE_ACCEPTEE' | 'DEMANDE_REFUSEE'; createdAt: string };
type Notice = ActivityNotice | SpaceNotice | GroupNotice;

const endpoint = (notice: Notice) => notice.kind === 'space' ? `/api/workspace/notifications/${notice.id}/read` : notice.kind === 'group' ? `/api/group-memberships/notifications/${notice.id}/read` : `/api/notifications/${notice.id}/read`;

export function AccountNotifications({ onOpenBookings, onOpenRequests, owner }: { onOpenBookings: () => void; onOpenRequests: () => void; owner: boolean }) {
  const locale = useLocale();
  const t = (fr: string, en: string, nl: string) => tr(locale, fr, en, nl);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => Promise.all([
      owner ? Promise.resolve([] as ActivityNotice[]) : fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result).then((items: Omit<ActivityNotice, 'kind'>[]) => items.map(item => ({ ...item, kind: 'activity' as const }))),
      fetch('/api/workspace/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result).then((items: Omit<SpaceNotice, 'kind'>[]) => items.map(item => ({ ...item, kind: 'space' as const }))),
      owner ? Promise.resolve([] as GroupNotice[]) : fetch('/api/group-memberships/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result).then((items: Omit<GroupNotice, 'kind'>[]) => items.map(item => ({ ...item, kind: 'group' as const }))),
    ]).then(([activity, spaces, groups]) => {
      if (!controller.signal.aborted) {
        setNotices([...activity, ...spaces, ...groups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id));
        setError('');
      }
    }).catch(() => { if (!controller.signal.aborted) setError(tr(locale, 'Impossible de charger les notifications.', 'Could not load notifications.', 'Meldingen konden niet worden geladen.')); });
    void load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [attempt, owner, locale]);
  async function acknowledge(notice: Notice, open = false) {
    const key = `${notice.kind}-${notice.id}`;
    setBusyKey(key); setError('');
    try {
      await postJson(endpoint(notice));
      setNotices(items => items.filter(item => `${item.kind}-${item.id}` !== key));
      window.dispatchEvent(new Event('belconnect:notifications-changed'));
      setAttempt(value => value + 1);
    } catch {
      setError(t('Impossible de marquer cette notification comme lue. Réessayez.', 'Could not mark this notification as read. Try again.', 'Deze melding kon niet als gelezen worden gemarkeerd. Probeer opnieuw.'));
    } finally {
      setBusyKey('');
      if (open) {
        if (notice.kind === 'activity') onOpenBookings();
        else if (notice.kind === 'space') onOpenRequests();
        else navigate(notice.event === 'DEMANDE_RECUE' ? `/mon-espace?espace=${notice.spaceId}&rubrique=adhesions#organisation` : '/mon-espace#demandes');
      }
    }
  }
  function label(notice: Notice) {
    if (notice.kind === 'activity') return t('Activité annulée', 'Activity cancelled', 'Activiteit geannuleerd');
    if (notice.kind === 'space') return notice.event === 'DEMANDE_RECUE' ? t('Nouvelle demande d’espace', 'New space request', 'Nieuwe ruimteaanvraag') : notice.event === 'DEMANDE_APPROUVEE' ? t('Espace approuvé', 'Space approved', 'Ruimte goedgekeurd') : t('Demande d’espace refusée', 'Space request declined', 'Ruimteaanvraag geweigerd');
    return notice.event === 'DEMANDE_RECUE' ? t('Nouvelle demande d’adhésion', 'New membership request', 'Nieuwe lidmaatschapsaanvraag') : notice.event === 'DEMANDE_ACCEPTEE' ? t('Adhésion acceptée', 'Membership accepted', 'Lidmaatschap goedgekeurd') : t('Adhésion refusée', 'Membership declined', 'Lidmaatschap geweigerd');
  }
  return <section className="account-notifications" id="notifications" aria-label={t('Notifications', 'Notifications', 'Meldingen')}>
    <h2>{t('Notifications récentes', 'Recent notifications', 'Recente meldingen')}</h2>
    {!notices.length && !error && <p className="account-notice account-notice-empty">{t('Aucune nouvelle notification. Les demandes, décisions et annulations apparaîtront ici.', 'No new notifications. Requests, decisions and cancellations will appear here.', 'Geen nieuwe meldingen. Aanvragen, beslissingen en annuleringen verschijnen hier.')}</p>}
    {error && <p role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>{t('Réessayer', 'Try again', 'Opnieuw proberen')}</button></p>}
    <div className="account-notification-list">{notices.map(notice => {
      const key = `${notice.kind}-${notice.id}`;
      const name = notice.kind === 'activity' ? notice.title : notice.kind === 'space' ? notice.name : notice.groupName;
      const destination = notice.kind === 'activity' ? '#mes-inscriptions' : notice.kind === 'space' ? owner ? '#a-traiter' : '#demandes' : notice.event === 'DEMANDE_RECUE' ? `/mon-espace?espace=${notice.spaceId}&rubrique=adhesions#organisation` : '#demandes';
      const action = notice.kind === 'activity' ? t('Voir mon inscription', 'View my booking', 'Mijn inschrijving bekijken') : notice.event === 'DEMANDE_RECUE' ? t('Examiner la demande', 'Review request', 'Aanvraag beoordelen') : t('Voir la demande', 'View request', 'Aanvraag bekijken');
      return <article className="account-notice" key={key}>
        <p><strong>{label(notice)} :</strong> {name}</p>
        <time dateTime={notice.createdAt}>{new Intl.DateTimeFormat(locale === 'fr' ? 'fr-BE' : locale === 'nl' ? 'nl-BE' : 'en-BE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notice.createdAt))}</time>
        <div className="management-actions"><a className="text-link" href={destination} onClick={event => { event.preventDefault(); void acknowledge(notice, true); }}>{action}</a><button className="text-link" disabled={Boolean(busyKey)} onClick={() => void acknowledge(notice)}>{busyKey === key ? t('Enregistrement…', 'Saving…', 'Opslaan…') : t('Marquer comme lu', 'Mark as read', 'Markeren als gelezen')}</button></div>
      </article>;
    })}</div>
  </section>;
}
