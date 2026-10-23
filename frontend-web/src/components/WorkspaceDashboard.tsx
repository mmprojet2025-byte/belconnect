import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import { SpaceDashboardCharts } from './DashboardCharts';

type Overview = {
  owner: boolean;
  spaces: { id: number; name: string; role: string }[];
  groups: { id: number; spaceId: number; name: string; role: string; canManageMemberships: boolean; canManageActivities?: boolean }[];
  projects: { id: number; title: string; status: string; spaceName: string }[];
};
type Finance = { activeSpaces: number; proSpaces: number; paidTransactions: number; pendingRefunds: number };
type Queue = { memberships: number; projects: number; openings: number };
type OwnerActivitySummary = { upcomingActivities: number; availablePlaces: number; paidTickets: number };
type Booking = { id: number; title: string; startsAt: string; status: string; activityCancelled: boolean; quantity: number };

export function WorkspaceDashboard({ data, firstName, onRefresh, refreshToken = 0 }: { data: Overview; firstName: string; onRefresh: () => void; refreshToken?: number }) {
  const organizer = !data.owner && data.spaces.some(space => space.role === 'ADMINISTRATEUR');
  const referent = !data.owner && data.groups.some(group => group.role === 'REFERENT');
  const manager = organizer || referent || data.groups.some(group => group.canManageMemberships);
  const role = data.owner ? 'Propriétaire' : organizer ? 'Administrateur d’espace' : referent ? 'Référent de groupe' : 'Membre';
  const [finance, setFinance] = useState<Finance | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState('');
  const [activityError, setActivityError] = useState(false);
  const [ownerActivities, setOwnerActivities] = useState<OwnerActivitySummary | null>(null);
  const adminSpaces = data.spaces.filter(space => space.role === 'ADMINISTRATEUR');
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const currentSpaceId = adminSpaces.some(space => space.id === selectedSpaceId) ? selectedSpaceId : adminSpaces[0]?.id;
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [bookingError, setBookingError] = useState(false);

  useEffect(() => {
    if (data.owner || organizer) return;
    const controller = new AbortController();
    fetch('/api/bookings', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result)
      .then((bookings: Booking[]) => {
        if (controller.signal.aborted) return;
        const next = bookings.filter(booking => booking.status === 'CONFIRMEE' && !booking.activityCancelled && new Date(booking.startsAt).getTime() > Date.now())
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null;
        setNextBooking(next); setBookingError(false); setBookingLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) { setBookingError(true); setBookingLoading(false); } });
    return () => controller.abort();
  }, [data, organizer]);

  useEffect(() => {
    if (!data.owner) return;
    const controller = new AbortController();
    fetch('/api/workspace/owner/activities-summary', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result)
      .then((summary: OwnerActivitySummary) => { if (!controller.signal.aborted) { setOwnerActivities(summary); setActivityError(false); } })
      .catch(() => { if (!controller.signal.aborted) setActivityError(true); });
    return () => controller.abort();
  }, [data]);

  useEffect(() => {
    if (!data.owner && !manager) return;
    const controller = new AbortController();
    const options = { credentials: 'same-origin' as const, cache: 'no-store' as const, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) };
    const load = data.owner
      ? Promise.all([
          fetch('/api/workspace/owner/finance', options).then(result) as Promise<Finance>,
          fetch('/api/workspace/opening-requests', options).then(result) as Promise<{ status: string }[]>,
        ]).then(([numbers, requests]) => {
          if (!controller.signal.aborted) { setFinance(numbers); setQueue({ openings: requests.filter(item => item.status === 'EN_ATTENTE').length, memberships: 0, projects: 0 }); }
        })
      : Promise.all([
          fetch('/api/group-memberships/received', options).then(result) as Promise<{ status: string; available: boolean }[]>,
          fetch('/api/project-reviews', options).then(result) as Promise<{ status: string; canReview: boolean; canDecide: boolean }[]>,
        ]).then(([memberships, projects]) => {
          if (!controller.signal.aborted) setQueue({ openings: 0, memberships: memberships.filter(item => item.status === 'EN_ATTENTE' && item.available).length, projects: projects.filter(item => item.status === 'SOUMIS' && (item.canReview || item.canDecide)).length });
        });
    void load.then(() => { if (!controller.signal.aborted) setError(''); }).catch(() => { if (!controller.signal.aborted) setError('Les indicateurs ne sont pas disponibles. Vous pouvez toujours ouvrir les rubriques de gestion.'); });
    return () => controller.abort();
  }, [data.owner, manager, data]);

  const tasks = queue ? queue.openings + queue.memberships + queue.projects : null;
  return <div className={`workspace-dashboard workspace-dashboard--organizer${organizer ? ' workspace-dashboard--single' : ''}`}>
    <header className="dashboard-hero"><span className="dashboard-eyebrow">Belconnect · {role}</span><h2>Bonjour {firstName} !</h2><p>{data.owner ? 'Suivez les espaces et prenez les décisions qui relèvent de Belconnect.' : manager ? 'Retrouvez vos espaces et les demandes qui attendent votre décision.' : 'Retrouvez vos groupes, vos projets et vos participations au même endroit.'}</p></header>
    <div className="dashboard-main"><div className="account-section-heading"><h2>Vue d’ensemble</h2><button className="text-link" type="button" onClick={onRefresh}>Actualiser</button></div>
    {error && <p className="account-notice" role="alert">{error}</p>}
    <div className="dashboard-stats" aria-label="Indicateurs de mon espace">
      {data.owner ? <>
        <div className="dashboard-stat"><strong>{finance?.activeSpaces ?? '—'}</strong><span>espaces actifs</span></div>
        <div className="dashboard-stat"><strong>{finance?.proSpaces ?? '—'}</strong><span>abonnements Pro actifs</span></div>
        <a className="dashboard-stat" href="/mon-espace#suivi-belconnect"><strong>{finance?.pendingRefunds ?? '—'}</strong><span>remboursements en cours · voir le suivi</span></a>
      </> : <>
        <div className="dashboard-stat"><strong>{data.spaces.length}</strong><span>mes espaces</span></div>
        <div className="dashboard-stat"><strong>{data.groups.length}</strong><span>mes groupes</span></div>
        <div className="dashboard-stat"><strong>{data.projects.length}</strong><span>mes projets</span></div>
      </>}
    </div>
    {organizer && currentSpaceId != null && <><label className="dashboard-space-selector">Espace suivi<select value={currentSpaceId} onChange={event => setSelectedSpaceId(Number(event.target.value))}>{adminSpaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><SpaceDashboardCharts key={currentSpaceId} spaceId={currentSpaceId} view="places" refreshToken={refreshToken} /></>}
    {(data.owner || manager) && <section className="dashboard-panel" aria-labelledby="dashboard-tasks"><div className="account-section-heading"><h2 id="dashboard-tasks">{data.owner ? 'Demandes d’ouverture à examiner' : 'Demandes à examiner'}</h2><a className="text-link" href="/mon-espace#a-traiter">Voir les demandes →</a></div>
      {tasks === null ? <p role={error ? undefined : 'status'}>{error ? 'Demandes momentanément indisponibles.' : 'Chargement des demandes…'}</p> : tasks === 0 ? <p>Aucune demande en attente pour le moment.</p> : <div className="dashboard-action-list">
        {queue!.openings > 0 && <a href="/mon-espace#a-traiter"><span>Ouvertures d’espace à examiner</span><strong>{queue!.openings} →</strong></a>}
        {queue!.memberships > 0 && <a href="/mon-espace#a-traiter"><span>Adhésions à examiner</span><strong>{queue!.memberships} →</strong></a>}
        {queue!.projects > 0 && <a href="/mon-espace#a-traiter"><span>Projets à examiner</span><strong>{queue!.projects} →</strong></a>}
      </div>}
    </section>}
    {data.owner && <p className="workspace-description">Chiffres locaux en mode test, hors espace de démonstration. Les graphiques détaillés sont dans « Suivi de Belconnect ».</p>}</div>
    {data.owner && <aside className="dashboard-rail" aria-label="Suivi des activités de Belconnect"><section className="dashboard-panel dashboard-activity-card"><span className="dashboard-eyebrow">Activités · plateforme</span><h2>À venir sur Belconnect</h2>
      {activityError ? <p>Le suivi des activités est momentanément indisponible.</p> : ownerActivities ? <div className="dashboard-owner-metrics"><div><strong>{ownerActivities.upcomingActivities}</strong><span>activités à venir</span></div><div><strong>{ownerActivities.availablePlaces}</strong><span>places disponibles</span></div><div><strong>{ownerActivities.paidTickets}</strong><span>billets payés pour ces activités</span></div></div> : <p>Chargement des indicateurs…</p>}
      <p className="dashboard-metric-note">Hors espace de démonstration. Les remboursements sont exclus du nombre de billets payés.</p><a className="text-link" href="/mon-espace#suivi-belconnect">Voir le suivi financier →</a>
    </section></aside>}
    {!data.owner && !organizer && <aside className="dashboard-rail" aria-label="Mes espaces et participations">
      <section className="dashboard-panel"><span className="dashboard-eyebrow">Participer</span><h2>Mon prochain rendez-vous</h2>
        {bookingError ? <p>Vos inscriptions sont momentanément indisponibles.</p> : bookingLoading ? <p role="status">Chargement de vos inscriptions…</p> : nextBooking ? <><h3>{nextBooking.title}</h3><p>{new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(nextBooking.startsAt))} · {nextBooking.quantity} place{nextBooking.quantity > 1 ? 's' : ''}</p><a className="text-link" href="/mon-espace#mes-inscriptions">Voir mon inscription →</a></> : <><p>Aucune activité à venir dans vos inscriptions.</p><a className="text-link" href="/activites">Découvrir les activités →</a></>}
      </section>
      <section className="dashboard-panel"><span className="dashboard-eyebrow">Mes espaces</span><h2>Mes groupes</h2>
        {data.groups.length ? <ul className="dashboard-member-groups">{data.groups.map(group => <li key={group.id}><strong>{group.name}</strong><span>{data.spaces.find(space => space.id === group.spaceId)?.name ?? 'Espace organisateur'}</span></li>)}</ul> : <p>Vous n’avez pas encore rejoint de groupe.</p>}
        <a className="text-link" href="/mon-espace#espaces">Voir mes espaces et groupes →</a>
      </section>
    </aside>}
  </div>;
}
