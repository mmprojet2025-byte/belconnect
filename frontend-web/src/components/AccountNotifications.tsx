import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { navigate } from '../lib/navigation';
import { tr, useLocale } from '../lib/locale';
import { Icon } from './Icon';

type Notice = {
  source: 'activity' | 'project' | 'workspace' | 'group' | 'group-invite' | 'message';
  id: number;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  activityId: number | null;
  projectId: number | null;
  conversationId: number | null;
  event: string | null;
  spaceId: number | null;
};

export function AccountNotifications({ onOpenBookings, onOpenRequests, owner }: { onOpenBookings: () => void; onOpenRequests: () => void; owner: boolean }) {
  const locale = useLocale();
  const t = (fr: string, en: string, nl: string) => tr(locale, fr, en, nl);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => fetch('/api/mobile/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then((items: Notice[]) => { if (!controller.signal.aborted) { setNotices(items); setError(''); } })
      .catch(() => { if (!controller.signal.aborted) setError(tr(locale, 'Impossible de charger les notifications.', 'Could not load notifications.', 'Meldingen konden niet worden geladen.')); });
    void load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [attempt, locale]);

  async function acknowledge(notice: Notice, open = false) {
    const key = `${notice.source}-${notice.id}`;
    setBusyKey(key); setError('');
    try {
      if (!notice.readAt) {
        await postJson(`/api/mobile/notifications/${notice.source}/${notice.id}/read`);
        setNotices(items => items.map(item => `${item.source}-${item.id}` === key ? { ...item, readAt: new Date().toISOString() } : item));
        window.dispatchEvent(new Event('belconnect:notifications-changed'));
      }
      if (open) {
        if (notice.source === 'activity') onOpenBookings();
        else if (notice.source === 'project' && notice.projectId) navigate(`/projets/${notice.projectId}`);
        else if (notice.source === 'workspace') onOpenRequests();
        else if (notice.source === 'group') navigate(notice.event === 'DEMANDE_RECUE' && notice.spaceId ? `/mon-espace?espace=${notice.spaceId}&rubrique=adhesions#organisation` : '/mon-espace#demandes');
        else if (notice.source === 'group-invite') navigate('/groupes#invitations');
      }
    } catch {
      setError(t('Impossible de marquer cette notification comme lue. Réessayez.', 'Could not mark this notification as read. Try again.', 'Deze melding kon niet als gelezen worden gemarkeerd. Probeer opnieuw.'));
    } finally { setBusyKey(''); }
  }

  function label(notice: Notice) {
    if (notice.source === 'activity') return t('Activité annulée', 'Activity cancelled', 'Activiteit geannuleerd');
    if (notice.source === 'project') return notice.event === 'TERMINE' ? t('Projet terminé', 'Project completed', 'Project afgerond') : t('Projet retiré', 'Project withdrawn', 'Project verwijderd');
    if (notice.source === 'message') return t('Nouveau message', 'New message', 'Nieuw bericht');
    if (notice.source === 'group-invite') return t('Invitation à un groupe', 'Group invitation', 'Groepsuitnodiging');
    if (notice.source === 'workspace') return notice.event === 'DEMANDE_RECUE' ? t('Nouvelle demande d’espace', 'New space request', 'Nieuwe ruimteaanvraag') : notice.event === 'DEMANDE_APPROUVEE' ? t('Espace approuvé', 'Space approved', 'Ruimte goedgekeurd') : t('Demande d’espace refusée', 'Space request declined', 'Ruimteaanvraag geweigerd');
    return notice.event === 'DEMANDE_RECUE' ? t('Nouvelle demande d’adhésion', 'New membership request', 'Nieuwe lidmaatschapsaanvraag') : notice.event === 'DEMANDE_ACCEPTEE' ? t('Adhésion acceptée', 'Membership accepted', 'Lidmaatschap goedgekeurd') : t('Adhésion refusée', 'Membership declined', 'Lidmaatschap geweigerd');
  }
  function category(notice: Notice) {
    if (notice.source === 'activity') return t('ACTIVITÉ', 'ACTIVITY', 'ACTIVITEIT');
    if (notice.source === 'project') return t('PROJET', 'PROJECT', 'PROJECT');
    if (notice.source === 'message') return t('MESSAGE', 'MESSAGE', 'BERICHT');
    return notice.source === 'group' || notice.source === 'group-invite' ? t('GROUPE', 'GROUP', 'GROEP') : t('ESPACE', 'SPACE', 'RUIMTE');
  }
  const unread = notices.filter(notice => !notice.readAt);
  const history = notices.filter(notice => !!notice.readAt);
  const renderNotice = (notice: Notice) => {
    const key = `${notice.source}-${notice.id}`;
    const icon = notice.source === 'activity' ? 'calendar' : notice.source === 'project' ? 'folder' : notice.source === 'message' ? 'chat' : notice.source === 'group' || notice.source === 'group-invite' ? 'users' : 'inbox';
    const destination = notice.source === 'activity' ? '#mes-inscriptions' : notice.source === 'project' && notice.projectId ? `/projets/${notice.projectId}` : notice.source === 'group-invite' ? '/groupes#invitations' : notice.source === 'workspace' ? owner ? '#a-traiter' : '#demandes' : notice.source === 'group' ? notice.event === 'DEMANDE_RECUE' && notice.spaceId ? `/mon-espace?espace=${notice.spaceId}&rubrique=adhesions#organisation` : '#demandes' : null;
    const action = notice.source === 'activity' ? t('Voir mon inscription', 'View my booking', 'Mijn inschrijving bekijken') : notice.source === 'project' ? t('Voir le projet', 'View project', 'Project bekijken') : notice.source === 'group-invite' ? t('Répondre à l’invitation', 'Respond to invitation', 'Uitnodiging beantwoorden') : notice.source === 'workspace' || notice.source === 'group' ? t('Voir la demande', 'View request', 'Aanvraag bekijken') : '';
    const content = <><div className="account-notice-heading"><span className="account-notice-category"><Icon name={icon} />{category(notice)}</span>{!notice.readAt && <span className="account-notice-new">{t('Nouveau', 'New', 'Nieuw')}</span>}</div>
      <p className="account-notice-event">{label(notice)}</p>
      <p className="account-notice-title"><strong>{notice.title}</strong></p>
      <p>{notice.source === 'message' ? t('À consulter dans l’application mobile.', 'Open in the mobile app.', 'Open in de mobiele app.') : notice.message}</p>
      <time dateTime={notice.createdAt}>{new Intl.DateTimeFormat(locale === 'fr' ? 'fr-BE' : locale === 'nl' ? 'nl-BE' : 'en-BE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notice.createdAt))}</time></>;
    return <article className={`account-notice account-notice--${notice.source}${notice.readAt ? ' account-notice--read' : ''}`} key={key}>
      {notice.source === 'group-invite' ? <a className="account-notice-open" href="/groupes#invitations" onClick={event => { event.preventDefault(); void acknowledge(notice, true); }}>{content}</a> : content}
      <div className="management-actions">
        {destination && <a className="text-link" href={destination} onClick={event => { event.preventDefault(); void acknowledge(notice, true); }}>{action}</a>}
        {!notice.readAt && <button className="text-link" disabled={Boolean(busyKey)} onClick={() => void acknowledge(notice)}>{busyKey === key ? t('Enregistrement…', 'Saving…', 'Opslaan') : t('Marquer comme lu', 'Mark as read', 'Markeren als gelezen')}</button>}
      </div>
    </article>;
  };

  return <section className="account-notifications" id="notifications" aria-label={t('Notifications', 'Notifications', 'Meldingen')}>
    <h2>{t('Notifications récentes', 'Recent notifications', 'Recente meldingen')}</h2>
    {!notices.length && !error && <p className="account-notice account-notice-empty">{t('Aucune notification pour le moment.', 'No notifications yet.', 'Nog geen meldingen.')}</p>}
    {error && <p role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>{t('Réessayer', 'Try again', 'Opnieuw proberen')}</button></p>}
    {unread.length > 0 && <><h3>{t('À lire', 'Unread', 'Ongelezen')} · {unread.length}</h3><div className="account-notification-list">{unread.map(renderNotice)}</div></>}
    {history.length > 0 && <><h3>{t('Déjà lues', 'Read', 'Gelezen')}</h3><div className="account-notification-list">{history.map(renderNotice)}</div></>}
  </section>;
}
