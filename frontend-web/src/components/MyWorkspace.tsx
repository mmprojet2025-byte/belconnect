import { ManagedActivities } from './ManagedActivities';
import { GroupMembers } from './GroupMembers';
import { GroupMemberships } from './GroupMemberships';
import { GroupAnnouncements } from './GroupAnnouncements';
import { StripeConnectSetup } from './StripeConnectSetup';
import { SpaceSubscriptions } from './SpaceSubscriptions';
import { SpaceManagement, SpaceRequests } from './SpaceManagement';
import { ProjectParticipations } from './ProjectParticipations';
import { ProjectPublications } from './ProjectPublications';
import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import { ProjectInbox, SubmittedDetail } from './SubmittedProjects';
import { stageLabel } from '../lib/projects';
import { DraftEditor } from './DraftEditor';
import { Icon } from './Icon';
import { OwnerFinanceSummary } from './OwnerFinanceSummary';

type Space = { id: number; name: string; role: string };
type Overview = {
  owner: boolean;
  spaces: Space[];
  groups: { id: number; spaceId: number; name: string; role: string; canManageMemberships: boolean; canManageActivities: boolean }[];
  projects: { id: number; title: string; status: string; spaceName: string; reviewStage?: string | null }[];
  managedSpaces: Space[];
};
const statuses: Record<string, string> = { BROUILLON: 'Brouillon privé', SOUMIS: 'Soumis', A_CORRIGER: 'À corriger', APPROUVE: 'Approuvé', REFUSE: 'Refusé' };

export function MyWorkspace({ view = 'spaces', onOwnerChange }: { view?: 'spaces' | 'projects' | 'requests' | 'owner'; onOwnerChange?: (owner: boolean) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [submittedNotice, setSubmittedNotice] = useState('');
  const [openedSubmission, setOpenedSubmission] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [membersGroup, setMembersGroup] = useState<number | null>(null);
  const [managedSpace, setManagedSpace] = useState<number | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => { setData(value); onOwnerChange?.(Boolean(value.owner)); setError(''); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Impossible de charger votre espace.'); });
    refresh();
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [attempt, onOwnerChange]);
  if (error && !data) return <div className="account-empty" role="alert"><h3>Votre espace est indisponible</h3><p>{error}</p><button className="button outline" onClick={() => { setError(''); setData(null); setAttempt(n => n + 1); }}>Réessayer</button></div>;
  if (!data) return <p role="status">Chargement de vos espaces et projets…</p>;
  const projects = data.projects.filter(p => filter === 'ALL' || p.status === filter);
  return <div className="workspace-sections">
    {error && <p className="draft-error" role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Actualiser</button></p>}
    <div className="workspace-intro"><h2>{view === 'spaces' ? 'Mes espaces et groupes' : view === 'projects' ? 'Mes projets' : view === 'requests' ? 'Mes demandes' : 'Suivi de Belconnect'}</h2><p>{view === 'owner' ? 'Supervision globale de la plateforme.' : 'Retrouvez ici les informations et actions liées à cette rubrique.'}</p></div>
    <div className="workspace-panel" hidden={view !== 'spaces'}>
    <section aria-labelledby="workspace-title">
      <div className="account-section-heading"><h2 id="workspace-title">Mes espaces et groupes</h2><span>{data.spaces.length} espace{data.spaces.length > 1 ? 's' : ''}</span></div>
      {!data.spaces.length ? <div className="account-empty"><span><Icon name="users" /></span><h3>Votre aventure commence ici</h3><p>Votre compte vous permet de participer aux activités. Vous n’êtes pas encore rattaché à un espace organisateur ou à un groupe.</p><a className="button coral" href="/activites">Découvrir les activités <Icon name="arrow" /></a></div> :
        <div className="workspace-grid">{data.spaces.map(space => <article className="workspace-card" key={space.id}>
          <span className="account-status">{space.role === 'ADMINISTRATEUR' ? 'Administrateur d’espace' : 'Membre de l’espace'}</span><h3>{space.name}</h3>
          <p>{space.role === 'ADMINISTRATEUR' ? 'Vous êtes désigné pour administrer cet espace.' : 'Vous faites partie de cet espace organisateur.'}</p>
          {data.groups.some(g => g.spaceId === space.id) ? <ul>{data.groups.filter(g => g.spaceId === space.id).map(group => <li key={group.id}><Icon name="users" /><div><strong>{group.name}</strong><span>{group.role === 'ADMINISTRATEUR' ? 'Gestion directe' : group.role === 'REFERENT' ? 'Référent du groupe' : 'Membre du groupe'}</span>{group.role === 'REFERENT' && <><span>{group.canManageMemberships ? 'Adhésions : gestion autorisée' : 'Adhésions : gérées par l’administrateur'}</span><button className="text-link workspace-resume" disabled={membersGroup !== null} onClick={() => setMembersGroup(group.id)}>Voir les membres et mes permissions</button></>}</div></li>)}</ul> : <p className="workspace-muted">Aucune appartenance active à un groupe dans cet espace.</p>}
          {space.role === 'ADMINISTRATEUR' && <button className="button outline workspace-resume" disabled={managedSpace !== null} onClick={() => setManagedSpace(space.id)}>Gérer l’espace et les groupes</button>}
        </article>)}</div>}
      {data.groups.some(g => g.role === 'REFERENT') && <p className="account-notice">En tant que référent, vous accompagnez les projets de vos groupes. La décision finale revient à l’administrateur de l’espace.</p>}
    </section>
    {managedSpace !== null && <SpaceManagement key={managedSpace} spaceId={managedSpace} onChanged={() => setAttempt(n => n + 1)} onClose={() => setManagedSpace(null)} />}
    {data.spaces.some(space => space.role === 'ADMINISTRATEUR') && <section className="workspace-settings" aria-labelledby="workspace-settings-title"><div className="account-section-heading"><h2 id="workspace-settings-title">Réglages de l’organisation</h2></div><p>Abonnement et encaissement des activités, dons et projets.</p><button className="button outline" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(open => !open)}>{settingsOpen ? 'Masquer les réglages' : 'Gérer les paiements et l’abonnement'}</button>{settingsOpen && <div className="workspace-settings-content"><SpaceSubscriptions spaces={data.spaces.filter(space => space.role === 'ADMINISTRATEUR')} /><StripeConnectSetup spaces={data.spaces.filter(space => space.role === 'ADMINISTRATEUR')} /></div>}</section>}
    {membersGroup !== null && <GroupMembers key={membersGroup} groupId={membersGroup} onChanged={() => setAttempt(n => n + 1)} onClose={() => setMembersGroup(null)} />}
    {data.groups.length > 0 && <GroupAnnouncements groups={data.groups} />}
    {(data.spaces.some(s => s.role === 'ADMINISTRATEUR') || data.groups.some(g => g.canManageActivities)) && <div id="managed-activities"><ManagedActivities spaces={data.spaces.filter(s => s.role === 'ADMINISTRATEUR' || data.groups.some(g => g.spaceId === s.id && g.canManageActivities))} groups={data.groups.filter(g => g.canManageActivities)} /></div>}
    </div>
    <div className="workspace-panel" hidden={view !== 'requests'}>
      <GroupMemberships onChanged={() => setAttempt(n => n + 1)} />
      {(data.spaces.some(s => s.role === 'ADMINISTRATEUR') || data.groups.some(g => g.canManageMemberships)) && <GroupMemberships received onChanged={() => setAttempt(n => n + 1)} />}
      <SpaceRequests owner={data.owner} onChanged={() => setAttempt(n => n + 1)} />
    </div>
    <div className="workspace-panel" hidden={view !== 'projects'}>
    <section aria-labelledby="my-projects-title">
      <div className="account-section-heading"><h2 id="my-projects-title">Mes projets</h2><span>{data.projects.length} projet{data.projects.length > 1 ? 's' : ''}</span></div>
      {submittedNotice && <p className="account-notice" role="status">{submittedNotice}</p>}
      {editing === null && data.spaces.length > 0 && <button className="button coral workspace-create" onClick={() => setEditing('new')}>Créer un projet <Icon name="arrow" /></button>}
      {editing !== null && <DraftEditor key={editing} id={editing} spaces={data.spaces} groups={data.groups} onClose={() => setEditing(null)} onSubmitted={project => {
        setData(current => current && ({ ...current, projects: [project, ...current.projects.filter(p => p.id !== project.id)] }));
        setEditing(null); setFilter('ALL'); setSubmittedNotice(`Projet soumis. ${stageLabel(project.reviewStage)}. Il n’est pas publié.`);
      }} onSaved={draft => {
        setFilter('ALL');
        setData(current => current && ({ ...current, projects: [{ id: draft.id, title: draft.title, status: draft.status, spaceName: draft.spaceName }, ...current.projects.filter(p => p.id !== draft.id)] }));
      }} />}
      {data.projects.length > 0 && <div className="account-filters" aria-label="Filtrer mes projets">{[['ALL', 'Tous'], ...Object.entries(statuses)].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{value === 'ALL' ? data.projects.length : data.projects.filter(p => p.status === value).length}</span></button>)}</div>}
      {!data.projects.length ? <div className="workspace-card"><h3>Vos idées ont leur place ici</h3><p>Vous n’avez pas encore créé de projet. {data.spaces.length ? 'Commencez par enregistrer une idée en brouillon privé.' : 'Une appartenance active à un espace organisateur est nécessaire pour créer un projet.'}</p></div> : projects.length ? <div className="workspace-grid">{projects.map(project => <article key={project.id} className="workspace-card"><span className="account-status">{project.status === 'SOUMIS' ? stageLabel(project.reviewStage) : statuses[project.status] ?? project.status}</span><h3>{project.title}</h3><p>{project.spaceName} · Projet #{project.id}</p>{(project.status === 'BROUILLON' || project.status === 'A_CORRIGER') && <><p className="workspace-muted">{project.status === 'A_CORRIGER' ? 'Des corrections ont été demandées. Consultez les remarques avant de soumettre à nouveau.' : 'Ce brouillon reste visible uniquement par vous.'}</p><button className="text-link workspace-resume" disabled={editing !== null} onClick={() => setEditing(project.id)}>{project.status === 'A_CORRIGER' ? 'Consulter les remarques et corriger' : 'Ouvrir le brouillon'} <Icon name="arrow" /></button></>}{['SOUMIS', 'APPROUVE', 'REFUSE'].includes(project.status) && <><button className="text-link workspace-resume" aria-expanded={openedSubmission === project.id} onClick={() => setOpenedSubmission(openedSubmission === project.id ? null : project.id)}>{openedSubmission === project.id ? 'Masquer le projet' : project.status === 'SOUMIS' ? 'Consulter le projet soumis' : 'Consulter la décision'}</button>{openedSubmission === project.id && <SubmittedDetail id={project.id} />}</>}</article>)}</div> : <p className="account-empty">Aucun projet avec ce statut.</p>}
    </section>
    {(data.spaces.some(s => s.role === 'ADMINISTRATEUR') || data.groups.some(g => g.role === 'REFERENT')) && <ProjectInbox />}
    {data.spaces.some(s => s.role === 'ADMINISTRATEUR') && <><ProjectPublications /><ProjectParticipations received /></>}
    <p className="account-demo-note">Les projets peuvent être enregistrés en brouillon privé. La soumission transmet la version enregistrée pour examen. Les référents peuvent demander des corrections ou transmettre un avis favorable. L’administrateur peut approuver ou refuser les projets soumis de son espace.</p>
    </div>
    <div className="workspace-panel" hidden={view !== 'owner'}>
      {data.owner ? <><OwnerFinanceSummary /><section aria-labelledby="platform-title"><div className="account-section-heading"><h2 id="platform-title">Vue propriétaire</h2><span>{data.managedSpaces.length} espaces actifs</span></div><p className="workspace-description">Vue globale des espaces organisateurs de Belconnect.</p><div className="workspace-grid">{data.managedSpaces.map(space => <article className="workspace-card" key={space.id}><h3>{space.name}</h3><span className="account-status">Espace actif</span></article>)}</div>{!data.managedSpaces.length && <p>Aucun espace actif pour le moment.</p>}</section></> : <p className="account-empty">Ce suivi est réservé au propriétaire de Belconnect.</p>}
    </div>
  </div>;
}
