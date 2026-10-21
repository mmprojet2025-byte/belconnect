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
import { OwnerModeration } from './OwnerModeration';
import { navigate } from '../lib/navigation';
import { confirmLeavingEditor } from '../lib/unsavedChanges';

type Space = { id: number; name: string; role: string };
type Overview = {
  owner: boolean;
  spaces: Space[];
  groups: { id: number; spaceId: number; name: string; role: string; canManageMemberships: boolean; canManageActivities: boolean }[];
  projects: { id: number; title: string; status: string; spaceName: string; reviewStage?: string | null }[];
  managedSpaces: Space[];
  suspendedSpaces: { id: number; name: string; reason: string }[];
  moderationNotices: { spaceName: string; action: string; contentName: string; reason: string }[];
};
const statuses: Record<string, string> = { BROUILLON: 'Brouillon privé', SOUMIS: 'Soumis', A_CORRIGER: 'À corriger', APPROUVE: 'Approuvé', REFUSE: 'Refusé' };

export function MyWorkspace({ view = 'spaces', selectedSpaceId, createActivity = false, onOwnerChange, onActivityAccessChange }: { view?: 'spaces' | 'management' | 'projects' | 'requests' | 'owner' | 'owner-spaces'; selectedSpaceId?: number | null; createActivity?: boolean; onOwnerChange?: (owner: boolean) => void; onActivityAccessChange?: (allowed: boolean) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [submittedNotice, setSubmittedNotice] = useState('');
  const [openedSubmission, setOpenedSubmission] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [membersGroup, setMembersGroup] = useState<number | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [managementTab, setManagementTab] = useState<'activities' | 'projects' | 'community' | 'payments' | 'settings'>(createActivity ? 'activities' : 'community');
  const [communityTab, setCommunityTab] = useState<'groups' | 'memberships' | 'announcements'>('groups');
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then((value: Overview) => { setData(value); onOwnerChange?.(Boolean(value.owner)); onActivityAccessChange?.(!value.owner && (value.spaces.some(space => space.role === 'ADMINISTRATEUR') || value.groups.some(group => group.canManageActivities))); setError(''); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Impossible de charger votre espace.'); });
    refresh();
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [attempt, onOwnerChange, onActivityAccessChange]);
  if (error && !data) return <div className="account-empty" role="alert"><h3>Votre espace est indisponible</h3><p>{error}</p><button className="button outline" onClick={() => { setError(''); setData(null); setAttempt(n => n + 1); }}>Réessayer</button></div>;
  if (!data) return <p role="status">Chargement de vos espaces et projets…</p>;
  const projects = data.projects.filter(p => filter === 'ALL' || p.status === filter);
  const manageableSpaces = data.spaces.filter(space => space.role === 'ADMINISTRATEUR' || data.groups.some(group => group.spaceId === space.id && (group.role === 'REFERENT' || group.canManageActivities || group.canManageMemberships)));
  const activitySpaces = manageableSpaces.filter(space => space.role === 'ADMINISTRATEUR' || data.groups.some(group => group.spaceId === space.id && group.canManageActivities));
  const selectedSpace = manageableSpaces.find(space => space.id === selectedSpaceId && (!createActivity || activitySpaces.some(allowed => allowed.id === space.id)));
  const selectedSuspendedSpace = data.suspendedSpaces?.find(space => space.id === selectedSpaceId);
  const selectedGroups = data.groups.filter(group => group.spaceId === selectedSpace?.id);
  const isSpaceAdmin = selectedSpace?.role === 'ADMINISTRATEUR';
  const canManageMembers = isSpaceAdmin || selectedGroups.some(group => group.canManageMemberships);
  const canManageActivities = isSpaceAdmin || selectedGroups.some(group => group.canManageActivities);
  const canReviewProjects = isSpaceAdmin || selectedGroups.some(group => group.role === 'REFERENT');
  const activeManagementTab = !canManageActivities && managementTab === 'activities' ? 'community' : createActivity && canManageActivities ? 'activities' : managementTab;
  const canLeaveActivityCreation = confirmLeavingEditor;
  const chooseSpace = (id: number, startActivity = false) => { if (!canLeaveActivityCreation()) return; setManagementTab(startActivity ? 'activities' : 'community'); setCommunityTab('groups'); setMembersGroup(null); navigate(`/mon-espace?espace=${id}${startActivity ? '&creation=activite' : ''}#organisation`); };
  const changeManagementTab = (tab: typeof managementTab) => { if (tab === activeManagementTab || !canLeaveActivityCreation()) return; if (createActivity && selectedSpace) navigate(`/mon-espace?espace=${selectedSpace.id}#organisation`, true); setManagementTab(tab); };
  return <div className="workspace-sections">
    {error && <p className="draft-error" role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Actualiser</button></p>}
    {['management', 'owner', 'owner-spaces'].includes(view) && <div className="workspace-intro"><h2>{view === 'management' ? 'Gérer mon organisation' : view === 'owner-spaces' ? 'Espaces organisateurs' : 'Pilotage de la plateforme'}</h2><p>{view === 'owner' ? 'Indicateurs de la plateforme en mode test.' : view === 'owner-spaces' ? 'Consultez les espaces et intervenez en cas de signalement.' : 'Choisissez une rubrique pour gérer votre organisation.'}</p></div>}
    {view === 'spaces' && <div className="workspace-panel">
    {data.suspendedSpaces?.map(space => <div className="account-notice" role="status" key={space.id}><strong>{space.name} : espace suspendu par Belconnect.</strong> Les nouveaux accès publics, inscriptions et paiements sont arrêtés. {space.reason && <>Motif : {space.reason}</>} Contactez l’assistance pour demander un réexamen. Les réservations déjà payées restent à traiter. <button className="text-link" onClick={() => navigate(`/mon-espace?espace=${space.id}#organisation`)}>Traiter les réservations et remboursements</button></div>)}
    {data.moderationNotices?.map((notice, index) => <div className="account-notice" role="status" key={`${notice.spaceName}-${notice.contentName}-${index}`}><strong>{notice.contentName} est masqué par Belconnect.</strong> Espace : {notice.spaceName}. Motif : {notice.reason}. Les réservations déjà payées restent à traiter ; contactez l’assistance pour demander un réexamen.</div>)}
    <section aria-labelledby="workspace-title">
      <div className="account-section-heading"><h2 id="workspace-title">Mes espaces et groupes</h2><span>{data.spaces.length} espace{data.spaces.length > 1 ? 's' : ''}</span></div>
      {!data.spaces.length ? <div className="account-empty"><span><Icon name="users" /></span><h3>Aucun espace pour le moment</h3><p>{data.suspendedSpaces?.length ? 'Un espace suspendu figure ci-dessus. Contactez l’assistance pour demander un réexamen.' : 'Rejoignez un groupe existant ou demandez l’ouverture de votre propre espace ci-dessous.'}</p>{!data.suspendedSpaces?.length && <a className="button outline" href="/groupes">Découvrir les groupes <Icon name="arrow" /></a>}</div> :
        <div className="workspace-grid">{data.spaces.map(space => <article className="workspace-card" key={space.id}>
          <span className="account-status">{space.role === 'ADMINISTRATEUR' ? 'Administrateur d’espace' : 'Membre de l’espace'}</span><h3>{space.name}</h3>
          {data.groups.some(g => g.spaceId === space.id) ? <ul>{data.groups.filter(g => g.spaceId === space.id).map(group => <li key={group.id}><Icon name="users" /><div><strong>{group.name}</strong><span>{group.role === 'ADMINISTRATEUR' ? 'Administrateur' : group.role === 'REFERENT' ? 'Référent' : 'Membre'}</span></div></li>)}</ul> : <p className="workspace-muted">Aucun groupe lié à votre compte dans cet espace.</p>}
          {manageableSpaces.some(item => item.id === space.id) && <button className="button outline workspace-resume" onClick={() => chooseSpace(space.id)}>{space.role === 'ADMINISTRATEUR' ? 'Gérer cet espace' : 'Gérer mes groupes'}</button>}
        </article>)}</div>}
      {data.groups.some(g => g.role === 'REFERENT') && <p className="account-notice">En tant que référent, vous accompagnez les projets de vos groupes. La décision finale revient à l’administrateur de l’espace.</p>}
    </section>
    <SpaceRequests owner={false} mode="create" onChanged={() => setAttempt(n => n + 1)} />
    </div>}
    {view === 'management' && <div className="workspace-panel">
      <a className="text-link" href="/mon-espace#espaces">← Retour à mes espaces</a>
      {selectedSuspendedSpace && !createActivity ? <section aria-label="Obligations d’un espace suspendu"><div className="account-section-heading"><h2>{selectedSuspendedSpace.name} · suspendu</h2></div><p className="account-notice">Seules la consultation des inscriptions et la régularisation des annulations ou remboursements restent possibles. Contactez l’assistance pour demander un réexamen.</p><ManagedActivities spaces={[{ id: selectedSuspendedSpace.id, name: selectedSuspendedSpace.name, role: 'ADMINISTRATEUR' }]} groups={[]} settlementOnly /><ProjectPublications spaceId={selectedSuspendedSpace.id} settlementOnly /></section> : !selectedSpace ? <section aria-label="Choisir un espace à gérer"><div className="account-section-heading"><h2>{createActivity ? 'Choisir un espace pour l’activité' : 'Choisir un espace à gérer'}</h2></div>{(createActivity ? activitySpaces : manageableSpaces).length ? <div className="workspace-grid">{(createActivity ? activitySpaces : manageableSpaces).map(space => <button className="workspace-card workspace-select-card" key={space.id} onClick={() => chooseSpace(space.id, createActivity)}>{space.name}</button>)}</div> : <p className="account-empty">{createActivity ? 'Vous devez administrer un espace ou être autorisé à gérer les activités d’un groupe pour créer une activité.' : 'Vous ne gérez pas encore d’espace ou de groupe.'} <a href="/mon-espace#espaces">Voir mes espaces</a></p>}</section> : <>
      <div className="account-section-heading"><h2>{selectedSpace.name}</h2><button className="text-link" onClick={() => { if (canLeaveActivityCreation()) navigate('/mon-espace#organisation'); }}>Changer d’espace</button></div>
      <nav className="workspace-management-nav" aria-label="Gestion de l’organisation">
        {canManageActivities && <button aria-pressed={activeManagementTab === 'activities'} onClick={() => changeManagementTab('activities')}>Activités</button>}
        {canReviewProjects && <button aria-pressed={activeManagementTab === 'projects'} onClick={() => changeManagementTab('projects')}>Projets de l’espace</button>}
        {(isSpaceAdmin || selectedGroups.length > 0) && <button aria-pressed={activeManagementTab === 'community'} onClick={() => changeManagementTab('community')}>Communauté</button>}
        {isSpaceAdmin && <button aria-pressed={activeManagementTab === 'payments'} onClick={() => changeManagementTab('payments')}>Paiements</button>}
        {isSpaceAdmin && <button aria-pressed={activeManagementTab === 'settings'} onClick={() => changeManagementTab('settings')}>Réglages</button>}
      </nav>
      {activeManagementTab === 'community' && <>
        <nav className="workspace-subnav" aria-label="Communauté"><button aria-pressed={communityTab === 'groups'} onClick={() => { if (confirmLeavingEditor()) setCommunityTab('groups'); }}>Groupes</button>{canManageMembers && <button aria-pressed={communityTab === 'memberships'} onClick={() => { if (confirmLeavingEditor()) setCommunityTab('memberships'); }}>Adhésions</button>}{selectedGroups.some(group => group.role === 'ADMINISTRATEUR' || group.role === 'REFERENT') && <button aria-pressed={communityTab === 'announcements'} onClick={() => { if (confirmLeavingEditor()) setCommunityTab('announcements'); }}>Annonces</button>}</nav>
        {communityTab === 'groups' && (isSpaceAdmin ? <SpaceManagement key={`groups-${selectedSpace.id}`} section="groups" spaceId={selectedSpace.id} onChanged={() => setAttempt(n => n + 1)} /> : <section aria-label="Groupes de l’espace"><div className="account-section-heading"><h2>Mes groupes</h2></div><div className="workspace-grid">{selectedGroups.map(group => <article className="workspace-card" key={group.id}><h3>{group.name}</h3><p>{group.role === 'REFERENT' ? 'Référent' : 'Membre'}</p>{group.canManageMemberships && <button className="button outline" onClick={() => setMembersGroup(group.id)}>Voir les membres</button>}</article>)}</div>{membersGroup !== null && <GroupMembers key={membersGroup} groupId={membersGroup} onChanged={() => setAttempt(n => n + 1)} onClose={() => setMembersGroup(null)} />}</section>)}
        {communityTab === 'memberships' && canManageMembers && <GroupMemberships key={selectedSpace.id} received spaceId={selectedSpace.id} onChanged={() => setAttempt(n => n + 1)} />}
        {communityTab === 'announcements' && <GroupAnnouncements key={selectedSpace.id} groups={selectedGroups} />}
      </>}
      {activeManagementTab === 'payments' && isSpaceAdmin && <section className="workspace-settings" aria-labelledby="workspace-settings-title"><div className="account-section-heading"><h2 id="workspace-settings-title">Paiements et abonnement</h2></div><div className="workspace-settings-content"><SpaceSubscriptions key={selectedSpace.id} spaces={[selectedSpace]} /><StripeConnectSetup key={selectedSpace.id} spaces={[selectedSpace]} /></div></section>}
      {activeManagementTab === 'activities' && canManageActivities && <div id="managed-activities"><ManagedActivities key={`${selectedSpace.id}-${createActivity ? 'create' : 'list'}`} spaces={[selectedSpace]} groups={selectedGroups.filter(group => group.canManageActivities)} startCreating={createActivity} onCreationFinished={() => navigate(`/mon-espace?espace=${selectedSpace.id}#organisation`, true)} /></div>}
      {activeManagementTab === 'projects' && canReviewProjects && <><ProjectInbox key={`inbox-${selectedSpace.id}`} spaceId={selectedSpace.id} />{isSpaceAdmin && <><ProjectPublications key={`publications-${selectedSpace.id}`} spaceId={selectedSpace.id} /><ProjectParticipations key={`participations-${selectedSpace.id}`} received spaceId={selectedSpace.id} /></>}</>}
      {activeManagementTab === 'settings' && isSpaceAdmin && <SpaceManagement key={`settings-${selectedSpace.id}`} section="settings" spaceId={selectedSpace.id} onChanged={() => setAttempt(n => n + 1)} />}
      </>}
    </div>}
    {view === 'requests' && <div className="workspace-panel">
      {!data.owner && <GroupMemberships onChanged={() => setAttempt(n => n + 1)} />}
      <SpaceRequests owner={data.owner} mode={data.owner ? 'all' : 'list'} onChanged={() => setAttempt(n => n + 1)} />
    </div>}
    {view === 'projects' && <div className="workspace-panel">
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
    <p className="account-demo-note">Un projet en brouillon reste privé. Une fois soumis, l’équipe de l’espace l’examine avant sa publication.</p>
    </div>}
    {view === 'owner' && <div className="workspace-panel">
      {data.owner ? <OwnerFinanceSummary /> : <p className="account-empty">Ce suivi est réservé au propriétaire de Belconnect.</p>}
    </div>}
    {view === 'owner-spaces' && <div className="workspace-panel">
      {data.owner ? <OwnerModeration /> : <p className="account-empty">Cette vue est réservée au propriétaire de Belconnect.</p>}
    </div>}
  </div>
}
