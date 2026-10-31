import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type MembershipRequest = { id: number; spaceId: number; groupName: string; spaceName: string; applicant: string; status: string; available: boolean };
type ProjectRequest = { id: number; title: string; spaceId: number; spaceName: string; status: string; canReview: boolean; canDecide: boolean };

export function WorkQueue() {
  const [activities, setActivities] = useState<{ id: number; spaceName: string; content: { title: string } }[]>([]);
  const [memberships, setMemberships] = useState<MembershipRequest[]>([]);
  const [projects, setProjects] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const options = { credentials: 'same-origin' as const, cache: 'no-store' as const, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) };
    Promise.all([
      fetch('/api/managed-activities/publication-requests', options).then(result),
      fetch('/api/group-memberships/received', options).then(result) as Promise<MembershipRequest[]>,
      fetch('/api/project-reviews', options).then(result) as Promise<ProjectRequest[]>,
    ]).then(([activityRequests, received, submitted]) => {
      if (controller.signal.aborted) return;
      setActivities(activityRequests);
      setMemberships(received.filter(item => item.status === 'EN_ATTENTE' && item.available));
      setProjects(submitted.filter(item => item.status === 'SOUMIS' && (item.canReview || item.canDecide)));
      setError('');
    }).catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les tâches. Réessayez.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const refresh = () => { setLoading(true); setError(''); setRevision(value => value + 1); };
  return <section className="work-queue" aria-labelledby="work-queue-title">
    <div className="account-section-heading"><h2 id="work-queue-title">Demandes à examiner</h2><button className="text-link" onClick={refresh}>Actualiser</button></div>
    <p className="workspace-description">Les demandes qui attendent votre décision. Ouvrez le dossier pour consulter les détails avant de répondre.</p>
    {!loading && !error && activities.map(activity => <article className="workspace-card" key={activity.id}><h3>{activity.content.title}</h3><p>{activity.spaceName} · Publication à valider</p><a className="button outline" href="/mon-espace#mes-activites">Examiner dans Mes activités</a></article>)}
    {loading && <p role="status">Chargement des tâches…</p>}
    {error && <p role="alert" className="draft-error">{error}</p>}
    {!loading && !error && activities.length + memberships.length + projects.length === 0 && <div className="account-empty"><h3>Tout est à jour</h3><p>Aucune demande ne requiert votre décision pour le moment.</p></div>}
    {!loading && !error && (activities.length + memberships.length + projects.length > 0) && <div className="work-queue-list">
      {memberships.map(item => <article className="workspace-card" key={`membership-${item.id}`}><span className="account-status">Adhésion en attente</span><h3>{item.groupName}</h3><p>{item.applicant} · {item.spaceName}</p><a className="text-link" href={`/mon-espace?espace=${item.spaceId}&rubrique=adhesions#organisation`}>Examiner la demande →</a></article>)}
      {projects.map(item => <article className="workspace-card" key={`project-${item.id}`}><span className="account-status">Projet à examiner</span><h3>{item.title}</h3><p>{item.spaceName}</p><a className="text-link" href={`/mon-espace?espace=${item.spaceId}&rubrique=projets-a-examiner#organisation`}>Ouvrir le projet →</a></article>)}
    </div>}
  </section>;
}
