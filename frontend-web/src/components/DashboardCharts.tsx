import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Month = { month: string; activityCents: number; projectCents: number; donationCents: number };
type Activity = { id: number; title: string; capacity: number; remaining: number; confirmedPlaces: number };
type PaidActivity = Activity & { successfulPayments: number; paidCents: number; commissionCents: number; pendingPayments: number; refundedCents: number };
type SpaceCharts = { activities: Activity[]; months: Month[]; paidActivities: PaidActivity[]; paidProjects: PaidActivity[] };
type Subscription = { spaceId: number; spaceStatus: string; plan: string; status: string };
const euro = (cents: number) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const monthLabel = (value: string) => new Intl.DateTimeFormat('fr-BE', { month: 'short', year: '2-digit' }).format(new Date(`${value}T12:00:00`));

function MonthlyBars({ months, title, description }: { months: Month[]; title: string; description: string }) {
  const total = (row: Month) => row.activityCents + row.projectCents + row.donationCents;
  const max = Math.max(1, ...months.map(total));
  return <section className="dashboard-chart" aria-label={title}>
    <h3>{title}</h3><p>{description}</p>
    <div className="dashboard-chart-legend"><span>Activités</span><span>Projets</span><span>Dons</span></div>
    <div className="dashboard-chart-rows">{months.map(row => <div className="dashboard-chart-row" key={row.month}>
      <span>{monthLabel(row.month)}</span>
      <div className="dashboard-chart-track" aria-hidden="true">
        <span className="dashboard-chart-segment dashboard-chart-segment--activity" style={{ width: `${row.activityCents / max * 100}%` }} />
        <span className="dashboard-chart-segment dashboard-chart-segment--project" style={{ width: `${row.projectCents / max * 100}%` }} />
        <span className="dashboard-chart-segment dashboard-chart-segment--donation" style={{ width: `${row.donationCents / max * 100}%` }} />
      </div><strong>{euro(total(row))}</strong>
    </div>)}</div>
    {!months.some(row => total(row) > 0) && <p>Aucun paiement confirmé sur cette période.</p>}
  </section>;
}

export function OwnerDashboardCharts() {
  const [months, setMonths] = useState<Month[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/workspace/charts/owner', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(result) as Promise<Month[]>,
      fetch('/api/workspace/owner/subscriptions', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(result) as Promise<Subscription[]>,
    ]).then(([payments, plans]) => { if (!controller.signal.aborted) { setMonths(payments); setSubscriptions(plans); } })
      .catch(() => { if (!controller.signal.aborted) setError('Les graphiques sont momentanément indisponibles.'); });
    return () => controller.abort();
  }, []);
  const active = subscriptions?.filter(space => space.spaceStatus === 'ACTIF') ?? [];
  const pro = active.filter(space => space.plan === 'PRO' && space.status === 'ACTIF').length;
  const starter = active.length - pro;
  const attention = subscriptions?.filter(space => space.status === 'PAIEMENT_ECHOUE' || space.status === 'EN_ATTENTE').length ?? 0;
  return <section className="dashboard-panel dashboard-charts" aria-labelledby="owner-charts-title">
    <h2 id="owner-charts-title">Évolution et abonnements</h2>
    {error && <p role="alert">{error}</p>}
    {!error && (!months || !subscriptions) && <p role="status">Chargement des graphiques…</p>}
    {months && subscriptions && <div className="dashboard-charts-grid">
      <MonthlyBars months={months} title="Commissions confirmées · 6 mois" description="Paiements encore marqués payés, par mois de paiement. Abonnements et frais Stripe exclus." />
      <section className="dashboard-chart" aria-label="Formules des espaces actifs">
        <h3>Formules des espaces actifs</h3><p>Situation actuelle, hors espace de démonstration.</p>
        <div className="dashboard-chart-rows">
          {[{ label: 'Starter', count: starter }, { label: 'Pro actif', count: pro }].map(item => <div className="dashboard-chart-row" key={item.label}>
            <span>{item.label}</span><div className="dashboard-chart-track" aria-hidden="true"><span className="dashboard-chart-segment dashboard-chart-segment--activity" style={{ width: `${active.length ? item.count / active.length * 100 : 0}%` }} /></div><strong>{item.count}</strong>
          </div>)}
        </div>
        <p>{attention} abonnement{attention > 1 ? 's' : ''} à vérifier.</p>
        <a className="text-link" href="/mon-espace#abonnements-factures">Voir les abonnements →</a>
      </section>
    </div>}
  </section>;
}

export function SpaceDashboardCharts({ spaceId, view, refreshToken = 0 }: { spaceId: number; view: 'places' | 'payments'; refreshToken?: number }) {
  const [data, setData] = useState<SpaceCharts | null>(null);
  const [error, setError] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [activitySearch, setActivitySearch] = useState('');
  const [paymentKind, setPaymentKind] = useState('activities');
  const paidItems = paymentKind === 'projects' ? data?.paidProjects : data?.paidActivities;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspace/charts/spaces/${spaceId}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((value: SpaceCharts) => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError('Les graphiques de cet espace sont momentanément indisponibles.'); });
    return () => controller.abort();
  }, [spaceId, refreshToken]);
  return <section className="dashboard-panel dashboard-charts" aria-labelledby={view === 'places' ? 'space-places-title' : 'space-payments-title'}>
    <h2 id={view === 'places' ? 'space-places-title' : 'space-payments-title'}>{view === 'places' ? 'Places des prochaines activités' : 'Paiements de cet espace'}</h2>
    {error && <p role="alert">{error}</p>}
    {!error && !data && <p role="status">Chargement des graphiques…</p>}
    {data && (view === 'places' ? <div className="dashboard-chart" aria-label="Places des prochaines activités">
        <p>Inscriptions confirmées et places encore disponibles. Les places retenues pendant un paiement apparaissent dans l’écart.</p>
        {data.activities.length ? <div className="dashboard-chart-rows">{data.activities.map(activity => <div className="dashboard-chart-activity" key={activity.id}>
          <div><strong>{activity.title}</strong><span>{activity.confirmedPlaces} confirmée{activity.confirmedPlaces > 1 ? 's' : ''} · {activity.remaining} disponible{activity.remaining > 1 ? 's' : ''} / {activity.capacity}</span></div>
          <div className="dashboard-chart-track" aria-hidden="true"><span className="dashboard-chart-segment dashboard-chart-segment--activity" style={{ width: `${activity.confirmedPlaces / activity.capacity * 100}%` }} /><span className="dashboard-chart-segment dashboard-chart-segment--remaining" style={{ width: `${activity.remaining / activity.capacity * 100}%` }} /></div>
        </div>)}</div> : <p>Aucune activité publiée à venir.</p>}
        <a className="text-link" href="/mon-espace#mes-activites">Gérer les activités →</a>
      </div> : <div className="space-payment-ledger"><label className="workspace-filter">Type<select value={paymentKind} onChange={event => { setPaymentKind(event.target.value); setActivitySearch(''); }}><option value="activities">Activités</option><option value="projects">Projets</option></select></label><p>Suivi des inscriptions payantes · Mode test, aucun virement bancaire réel. Montants cumulés par activité ou projet.</p>{paidItems?.length ? <><div className="space-payment-filters"><label>Rechercher par nom<input type="search" value={activitySearch} onChange={event => setActivitySearch(event.target.value)} placeholder="Nom de l’activité ou du projet" /></label><label>État des paiements<select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}><option value="ALL">Toutes</option><option value="PAID">Paiements réussis</option><option value="PENDING">En attente</option><option value="REFUNDED">Remboursés</option></select></label></div><p className="management-hint">Ouvrez une ligne pour voir ses places et ses paiements. Le filtre retient les éléments ayant un paiement dans cet état.</p>{paidItems.filter(activity => activity.title.toLocaleLowerCase().includes(activitySearch.toLocaleLowerCase()) && (paymentFilter === 'ALL' || paymentFilter === 'PAID' && activity.successfulPayments > 0 || paymentFilter === 'PENDING' && activity.pendingPayments > 0 || paymentFilter === 'REFUNDED' && activity.refundedCents > 0)).map(activity => <details className="space-payment-entry space-payment-selectable" key={activity.id}><summary><strong>{activity.title}</strong><span>{euro(activity.paidCents)} payé brut</span></summary><div className="space-payment-groups"><section className="space-payment-group"><h4>Places</h4><dl className="space-payment-metrics"><div><dt>Confirmées</dt><dd>{activity.confirmedPlaces} / {activity.capacity}</dd></div><div><dt>Restantes</dt><dd>{activity.remaining}</dd></div></dl></section><section className="space-payment-group"><h4>Paiements</h4><dl className="space-payment-metrics"><div><dt>Réussis</dt><dd>{activity.successfulPayments}</dd></div><div><dt>Montant brut payé</dt><dd>{euro(activity.paidCents)}</dd></div></dl></section></div><details className="space-payment-details"><summary>Détails financiers</summary><dl className="space-payment-metrics">{[['Commission BelConnect', euro(activity.commissionCents)], ['Après commission', euro(activity.paidCents - activity.commissionCents)], ['Paiements en attente', activity.pendingPayments], ['Remboursé', euro(activity.refundedCents)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="management-hint">Le montant après commission ne confirme pas un virement bancaire et ne déduit pas d’éventuels frais Stripe. Les places restantes peuvent exclure des places temporairement retenues pendant un paiement.</p></details></details>)}{!paidItems.some(activity => activity.title.toLocaleLowerCase().includes(activitySearch.toLocaleLowerCase()) && (paymentFilter === 'ALL' || paymentFilter === 'PAID' && activity.successfulPayments > 0 || paymentFilter === 'PENDING' && activity.pendingPayments > 0 || paymentFilter === 'REFUNDED' && activity.refundedCents > 0)) && <p>Aucun résultat pour ces filtres.</p>}</> : <p>Aucune inscription payante à afficher pour ce type.</p>}</div>)}
  </section>;
}
