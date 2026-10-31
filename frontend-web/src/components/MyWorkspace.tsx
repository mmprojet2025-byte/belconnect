import { ManagedActivities } from './ManagedActivities';
import { GroupMembers } from './GroupMembers';
import { GroupMemberships } from './GroupMemberships';
import { GroupAnnouncements } from './GroupAnnouncements';
import { StripeConnectSetup } from './StripeConnectSetup';
import { SpaceInvoices } from './SpaceInvoices';
import { SpaceSubscriptions, SpaceUpgradeTeaser } from './SpaceSubscriptions';
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
import { WorkQueue } from './WorkQueue';
import { WorkspaceDashboard } from './WorkspaceDashboard';
import { SpaceDashboardCharts } from './DashboardCharts';

type Space = { id: number; name: string; role: string };
type Overview = {
  owner: boolean;
  spaces: Space[];
  groups: { id: number; spaceId: number; name: string; role: string; canManageMemberships: boolean; canManageActivities: boolean }[];
  projects: { id: number; title: string; status: string; spaceId?: number; spaceName: string; reviewStage?: string | null; published?: boolean }[];
  managedSpaces: Space[];
  suspendedSpaces: { id: number; name: string; reason: string }[];
  moderationNotices: { spaceName: string; action: string; contentName: string; reason: string }[];
};
const statuses: Record<string, string> = { BROUILLON: 'Brouillon privé', SOUMIS: 'Soumis', A_CORRIGER: 'À corriger', APPROUVE: 'Approuvé', REFUSE: 'Refusé', TERMINE: 'Terminé' };

export function MyWorkspace({ view = 'spaces', firstName = '', selectedSpaceId, selectedRubrique, createActivity = false, highlightActivityId, onOwnerChange, onOrganizerChange, onReferentChange, onActivityAccessChange, onTaskAccessChange }: { view?: 'dashboard' | 'inbox' | 'spaces' | 'groups' | 'activities' | 'management' | 'projects' | 'requests' | 'owner' | 'owner-spaces'; firstName?: string; selectedSpaceId?: number | null; selectedRubrique?: string | null; createActivity?: boolean; highlightActivityId?: number | null; onOwnerChange?: (owner: boolean) => void; onOrganizerChange?: (organizer: boolean) => void; onReferentChange?: (referent: boolean) => void; onActivityAccessChange?: (allowed: boolean) => void; onTaskAccessChange?: (allowed: boolean) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [submittedNotice, setSubmittedNotice] = useState('');
  const [highlightProjectId, setHighlightProjectId] = useState<number | null>(null);
  const [openedSubmission, setOpenedSubmission] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [membersGroup, setMembersGroup] = useState<number | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [projectPage, setProjectPage] = useState(0);
  const managementSections = ['groups', 'memberships', 'announcements', 'project-reviews', 'project-publications', 'project-helps', 'payments', 'settings'] as const;
  type ManagementSection = typeof managementSections[number];
  const requestedSection = selectedRubrique === 'adhesions' ? 'memberships' : selectedRubrique === 'projets-a-examiner' ? 'project-reviews' : selectedRubrique;
  const managementSection: ManagementSection = managementSections.find(item => item === requestedSection) ?? 'groups';
  useEffect(() => {
    if (view === 'management' && !selectedSpaceId) navigate('/mon-espace#espaces', true);
  }, [view, selectedSpaceId]);
  useEffect(() => {
    if (view !== 'spaces' || !data || window.location.search.includes('liste=1')) return;
    const manageable = data.spaces.filter(space => space.role === 'ADMINISTRATEUR' || data.groups.some(group => group.spaceId === space.id && (group.role === 'REFERENT' || group.canManageActivities || group.canManageMemberships)));
    if (manageable.length === 1) navigate(`/mon-espace?espace=${manageable[0].id}#organisation`, true);
  }, [view, data]);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then((value: Overview) => { setData(value); onOwnerChange?.(Boolean(value.owner)); onOrganizerChange?.(!value.owner && value.spaces.some(space => space.role === 'ADMINISTRATEUR')); onReferentChange?.(!value.owner && value.groups.some(group => group.role === 'REFERENT')); onActivityAccessChange?.(!value.owner && (value.spaces.some(space => space.role === 'ADMINISTRATEUR') || value.groups.some(group => group.canManageActivities))); onTaskAccessChange?.(!value.owner && (value.spaces.some(space => space.role === 'ADMINISTRATEUR') || value.groups.some(group => group.role === 'REFERENT' || group.canManageMemberships))); setError(''); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Impossible de charger votre espace.'); });
    refresh();
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [attempt, onOwnerChange, onOrganizerChange, onReferentChange, onActivityAccessChange, onTaskAccessChange]);
  if (error && !data) return <div className="account-empty" role="alert"><h3>Votre espace est indisponible</h3><p>{error}</p><button className="button outline" onClick={() => { setError(''); setData(null); setAttempt(n => n + 1); }}>Réessayer</button></div>;
  if (!data) return <p role="status">Chargement de vos espaces et projets…</p>;
  const sortedSpaces = [...data.spaces].sort((a, b) => Number(b.role === 'ADMINISTRATEUR') - Number(a.role === 'ADMINISTRATEUR') || a.name.localeCompare(b.name, 'fr'));
  const sortedGroups = [...data.groups].sort((a, b) => {
    const spaceA = data.spaces.find(space => space.id === a.spaceId)?.name ?? '';
    const spaceB = data.spaces.find(space => space.id === b.spaceId)?.name ?? '';
    return spaceA.localeCompare(spaceB, 'fr') || a.name.localeCompare(b.name, 'fr');
  });
  const projects = data.projects.filter(p => filter === 'ALL' || p.status === filter);
  const manageableSpaces = data.spaces.filter(space => space.role === 'ADMINISTRATEUR' || data.groups.some(group => group.spaceId === space.id && (group.role === 'REFERENT' || group.canManageActivities || group.canManageMemberships)));
  const activitySpaces = manageableSpaces.filter(space => space.role === 'ADMINISTRATEUR' || data.groups.some(group => group.spaceId === space.id && group.canManageActivities));
  const selectedSpace = manageableSpaces.find(space => space.id === selectedSpaceId);
  const selectedSuspendedSpace = data.suspendedSpaces?.find(space => space.id === selectedSpaceId);
  const selectedGroups = data.groups.filter(group => group.spaceId === selectedSpace?.id);
  const isSpaceAdmin = selectedSpace?.role === 'ADMINISTRATEUR';
  const canManageMembers = isSpaceAdmin || selectedGroups.some(group => group.canManageMemberships);
  const canReviewProjects = isSpaceAdmin || selectedGroups.some(group => group.role === 'REFERENT');
  const activeManagementSection = managementSection === 'memberships' && !canManageMembers || managementSection === 'announcements' && !selectedGroups.some(group => group.role === 'ADMINISTRATEUR' || group.role === 'REFERENT') || managementSection === 'project-reviews' && !canReviewProjects || (['project-publications', 'project-helps', 'payments', 'settings'].includes(managementSection) && !isSpaceAdmin) ? 'groups' : managementSection;
  const managementLabels: Record<ManagementSection, string> = { groups: 'Groupes', memberships: 'Demandes d’adhésion', announcements: 'Annonces', 'project-reviews': 'Projets à examiner', 'project-publications': 'Publications', 'project-helps': 'Aides reçues', payments: 'Paiements', settings: 'Réglages' };
  const canLeaveActivityCreation = confirmLeavingEditor;
  const chooseSpace = (id: number) => { if (!canLeaveActivityCreation()) return; setMembersGroup(null); navigate(`/mon-espace?espace=${id}#organisation`); };
  const changeManagementSection = (section: ManagementSection) => { if (section === managementSection || !canLeaveActivityCreation() || !selectedSpace) return; window.dispatchEvent(new Event('belconnect:close-account-menu')); navigate(`/mon-espace?espace=${selectedSpace.id}&rubrique=${section === 'memberships' ? 'adhesions' : section === 'project-reviews' ? 'projets-a-examiner' : section}#organisation`); };
  const contextNavigation = selectedSpace && <nav className="workspace-context-nav" aria-label={`Gérer ${selectedSpace.name}`}>
    {(isSpaceAdmin || selectedGroups.length > 0) && <button aria-current={activeManagementSection === 'groups' ? 'page' : undefined} onClick={() => changeManagementSection('groups')}>Groupes</button>}
    {canManageMembers && <button aria-current={activeManagementSection === 'memberships' ? 'page' : undefined} onClick={() => changeManagementSection('memberships')}>Demandes d’adhésion</button>}
    {selectedGroups.some(group => group.role === 'ADMINISTRATEUR' || group.role === 'REFERENT') && <button aria-current={activeManagementSection === 'announcements' ? 'page' : undefined} onClick={() => changeManagementSection('announcements')}>Annonces</button>}
    {canReviewProjects && <button aria-current={activeManagementSection === 'project-reviews' ? 'page' : undefined} onClick={() => changeManagementSection('project-reviews')}>Projets à examiner</button>}
    {isSpaceAdmin && <><button aria-current={activeManagementSection === 'project-publications' ? 'page' : undefined} onClick={() => changeManagementSection('project-publications')}>Publications</button><button aria-current={activeManagementSection === 'project-helps' ? 'page' : undefined} onClick={() => changeManagementSection('project-helps')}>Aides reçues</button><button aria-current={activeManagementSection === 'payments' ? 'page' : undefined} onClick={() => changeManagementSection('payments')}>Paiements</button><button aria-current={activeManagementSection === 'settings' ? 'page' : undefined} onClick={() => changeManagementSection('settings')}>Réglages</button></>}
  </nav>;
  return <div className="workspace-sections">
    {error && <p className="draft-error" role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Actualiser</button></p>}
    {(['activities', 'spaces', 'groups', 'projects', 'requests'] as const).includes(view as 'activities' | 'spaces' | 'groups' | 'projects' | 'requests') && <div className="account-welcome workspace-section-banner">
      <span className="account-welcome-icon"><Icon name={view === 'activities' ? 'calendar' : view === 'projects' ? 'folder' : view === 'requests' ? 'document' : 'users'} /></span>
      <div><h2>{view === 'activities' ? 'Mes activités' : view === 'spaces' ? 'Mes espaces' : view === 'groups' ? 'Mes groupes' : view === 'projects' ? 'Mes projets' : 'Mes demandes'}</h2><p>{view === 'activities' ? 'Créez et suivez les activités que vous organisez.' : view === 'spaces' ? 'Retrouvez les espaces que vous gérez ou auxquels vous participez.' : view === 'groups' ? 'Retrouvez vos groupes et accédez à leurs échanges.' : view === 'projects' ? 'Créez vos projets et suivez leur publication.' : 'Demandez un espace organisateur et suivez la réponse de Belconnect.'}</p></div>
    </div>}
    {view === 'dashboard' && <WorkspaceDashboard data={data} firstName={firstName} refreshToken={attempt} onRefresh={() => setAttempt(value => value + 1)} />}
    {view === 'inbox' && (data.owner ? <SpaceRequests owner onChanged={() => setAttempt(n => n + 1)} mode="inbox" /> : manageableSpaces.length ? <WorkQueue /> : <div className="account-empty"><h3>Aucune tâche de gestion</h3><p>Les décisions confiées à un administrateur ou à un référent apparaîtront ici.</p></div>)}
    {['owner', 'owner-spaces'].includes(view) && <div className="workspace-intro"><h2>{view === 'owner-spaces' ? 'Espaces organisateurs' : 'Pilotage de la plateforme'}</h2><p>{view === 'owner' ? 'Indicateurs de la plateforme en mode test.' : 'Consultez les espaces et intervenez en cas de signalement.'}</p></div>}
    {(view === 'spaces' || view === 'groups') && <div className="workspace-panel">
    {view === 'spaces' && data.suspendedSpaces?.map(space => <div className="account-notice" role="status" key={space.id}><strong>{space.name} : espace suspendu par Belconnect.</strong> Les nouveaux accès publics, inscriptions et paiements sont arrêtés. {space.reason && <>Motif : {space.reason}</>} Contactez l’assistance pour demander un réexamen. Les réservations déjà payées restent à traiter. <button className="text-link" onClick={() => navigate(`/mon-espace?espace=${space.id}#organisation`)}>Traiter les réservations et remboursements</button></div>)}
    {view === 'spaces' && data.moderationNotices?.map((notice, index) => <div className="account-notice" role="status" key={`${notice.spaceName}-${notice.contentName}-${index}`}><strong>{notice.contentName} est masqué par Belconnect.</strong> Espace : {notice.spaceName}. Motif : {notice.reason}. Les réservations déjà payées restent à traiter ; contactez l’assistance pour demander un réexamen.</div>)}
    <section aria-labelledby="workspace-title">
      <div className="account-section-heading"><h2 className="sr-only" id="workspace-title">{view === 'spaces' ? 'Mes espaces' : 'Mes groupes'}</h2><span>{view === 'spaces' ? data.spaces.length : data.groups.length} {view === 'spaces' ? `espace${data.spaces.length > 1 ? 's' : ''}` : `groupe${data.groups.length > 1 ? 's' : ''}`}</span></div>
      <p className="workspace-description">{view === 'spaces' ? 'Un espace vous permet d’organiser vos groupes et leurs activités. Ouvrez un espace pour le gérer, ou faites une demande pour en créer un.' : 'Un groupe rassemble ses membres dans un espace. Retrouvez ici les groupes auxquels vous avez accès.'}</p>
      {view === 'spaces' && (!data.spaces.length ? <div className="account-empty"><span><Icon name="users" /></span><h3>Aucun espace pour le moment</h3><p>{data.suspendedSpaces?.length ? 'Un espace suspendu figure ci-dessus. Contactez l’assistance pour demander un réexamen.' : 'Vous pouvez rejoindre un groupe ou demander l’ouverture d’un espace organisateur.'}</p>{!data.suspendedSpaces?.length && <div className="booking-actions"><a className="button outline" href="/groupes">Découvrir les groupes <Icon name="arrow" /></a><a className="button outline" href="/mon-espace#demandes">Demander un espace <Icon name="arrow" /></a></div>}</div> :
        <div className="workspace-grid">{sortedSpaces.map(space => <article className="workspace-card workspace-access-card" key={space.id}>
          <h3>{space.name}</h3><span className="account-status">{space.role === 'ADMINISTRATEUR' ? 'Vous administrez cet espace' : 'Vous participez à cet espace'}</span>
          <p className="workspace-muted">{data.groups.filter(group => group.spaceId === space.id).length} groupe{data.groups.filter(group => group.spaceId === space.id).length > 1 ? 's' : ''} lié{data.groups.filter(group => group.spaceId === space.id).length > 1 ? 's' : ''} à votre compte</p>
          {space.role === 'ADMINISTRATEUR' && <SpaceUpgradeTeaser space={space} />}
          {manageableSpaces.some(item => item.id === space.id) && <button className="button outline workspace-resume" onClick={() => chooseSpace(space.id)}>{space.role === 'ADMINISTRATEUR' ? 'Gérer cet espace' : 'Voir mes tâches de référent'}</button>}
        </article>)}</div>)}
      {view === 'groups' && (data.groups.length ? <div className="workspace-group-sections">{[...new Set(sortedGroups.map(group => group.spaceId))].map(spaceId => <section key={spaceId} aria-label={`Groupes de ${data.spaces.find(space => space.id === spaceId)?.name ?? 'cet espace'}`}><h3 className="workspace-group-heading">{data.spaces.find(space => space.id === spaceId)?.name ?? 'Espace organisateur'}</h3><div className="workspace-grid">{sortedGroups.filter(group => group.spaceId === spaceId).map(group => <article className="workspace-card workspace-access-card" key={group.id}><h4>{group.name}</h4><span className="account-status">{group.role === 'GESTION_ESPACE' ? 'Géré via l’espace' : group.role === 'ADMINISTRATEUR' ? 'Administrateur du groupe' : group.role === 'REFERENT' ? 'Référent du groupe' : 'Membre du groupe'}</span>{group.role === 'REFERENT' && <p className="workspace-muted">Projets et annonces{group.canManageMemberships ? ' · Adhésions' : ''}{group.canManageActivities ? ' · Activités' : ''}</p>}<a className="text-link workspace-resume" href={`/groupes?groupe=${group.id}`}>Voir le groupe →</a></article>)}</div></section>)}</div> : <div className="account-empty"><h3>Aucun groupe pour le moment</h3><p>Découvrez les groupes et demandez à rejoindre celui qui vous intéresse.</p><a className="button outline" href="/groupes">Découvrir les groupes <Icon name="arrow" /></a></div>)}
    </section>
    </div>}
    {view === 'activities' && <div className="workspace-panel">{activitySpaces.length ? <ManagedActivities key={createActivity ? 'create' : 'list'} spaces={activitySpaces} groups={data.groups.filter(group => group.canManageActivities)} startCreating={createActivity} highlightId={highlightActivityId} onCreationFinished={id => navigate(id ? `/mon-espace?activite=${id}#mes-activites` : '/mon-espace#mes-activites', true)} /> : <div className="account-empty"><h3>Aucune activité à gérer</h3><p>Vous devez administrer un espace ou être autorisé à gérer les activités d’un groupe.</p><a href="/mon-espace#espaces">Voir mes espaces</a></div>}</div>}
    {view === 'management' && <div className="workspace-panel">
      {!selectedSpaceId && <a className="text-link" href="/mon-espace#espaces">← Retour à mes espaces</a>}
      {selectedSuspendedSpace ? <section aria-label="Obligations d’un espace suspendu"><div className="account-section-heading"><h2>{selectedSuspendedSpace.name} · suspendu</h2></div><p className="account-notice">Seules la consultation des inscriptions et la régularisation des annulations ou remboursements restent possibles. Contactez l’assistance pour demander un réexamen.</p><ManagedActivities spaces={[{ id: selectedSuspendedSpace.id, name: selectedSuspendedSpace.name, role: 'ADMINISTRATEUR' }]} groups={[]} settlementOnly /><ProjectPublications spaceId={selectedSuspendedSpace.id} settlementOnly /></section> : !selectedSpace ? <p role="status">Retour à mes espaces…</p> : <>
      <header className="workspace-context-header">
        <div className="workspace-context-heading"><span className="workspace-context-symbol"><Icon name="users" /></span><div><span className="workspace-context-kicker">Espace organisateur</span><h2>{selectedSpace.name}</h2><p>{isSpaceAdmin ? 'Vous administrez cet espace.' : 'Vous gérez les rubriques autorisées de vos groupes.'}</p></div></div>
        <div className="workspace-context-header-actions"><span className="workspace-context-role">{isSpaceAdmin ? 'Administrateur' : 'Référent'}</span><button className="button outline" onClick={() => { if (canLeaveActivityCreation()) navigate('/mon-espace?liste=1#espaces'); }}>Voir tous mes espaces</button></div>
        <div className="workspace-context-location" aria-label="Rubrique actuelle"><span>Gestion de l’espace</span><Icon name="chevron" /><strong>{managementLabels[activeManagementSection]}</strong></div>
      </header>
      <div className="workspace-management-layout">
        {contextNavigation}
        <div className="workspace-context-content">
          {activeManagementSection === 'groups' && (isSpaceAdmin ? <SpaceManagement key={`groups-${selectedSpace.id}`} section="groups" spaceId={selectedSpace.id} onChanged={() => setAttempt(n => n + 1)} /> : <section aria-label="Groupes de l’espace"><div className="account-section-heading"><h2>Mes groupes</h2></div><p className="workspace-description">Vos droits de référent concernent uniquement les groupes indiqués ci-dessous. L’administrateur garde la décision finale sur les projets.</p><div className="workspace-grid">{selectedGroups.map(group => <article className="workspace-card" key={group.id}><h3>{group.name}</h3><p>{group.role === 'REFERENT' ? 'Référent du groupe' : 'Membre du groupe'}</p>{group.role === 'REFERENT' && <p className="workspace-muted">Projets et annonces{group.canManageMemberships ? ' · Adhésions' : ''}{group.canManageActivities ? ' · Activités' : ''}</p>}{group.canManageMemberships && <button className="button outline" onClick={() => setMembersGroup(group.id)}>Voir les membres</button>}</article>)}</div>{membersGroup !== null && selectedGroups.some(group => group.id === membersGroup) && <GroupMembers key={membersGroup} groupId={membersGroup} onChanged={() => setAttempt(n => n + 1)} onClose={() => setMembersGroup(null)} />}</section>)}
          {activeManagementSection === 'memberships' && <GroupMemberships key={selectedSpace.id} received spaceId={selectedSpace.id} onChanged={() => setAttempt(n => n + 1)} />}
          {activeManagementSection === 'announcements' && <GroupAnnouncements key={selectedSpace.id} groups={selectedGroups} />}
          {activeManagementSection === 'project-reviews' && <ProjectInbox key={`inbox-${selectedSpace.id}`} spaceId={selectedSpace.id} />}
          {activeManagementSection === 'project-publications' && <ProjectPublications key={`publications-${selectedSpace.id}`} spaceId={selectedSpace.id} />}
          {activeManagementSection === 'project-helps' && <ProjectParticipations key={`participations-${selectedSpace.id}`} received spaceId={selectedSpace.id} />}
          {activeManagementSection === 'payments' && <section className="workspace-settings" aria-labelledby="workspace-settings-title"><div className="account-section-heading"><h2 id="workspace-settings-title">Paiements et abonnement</h2></div><div className="workspace-settings-content"><SpaceDashboardCharts key={`payments-${selectedSpace.id}`} spaceId={selectedSpace.id} view="payments" /><SpaceSubscriptions key={selectedSpace.id} spaces={[selectedSpace]} /><SpaceInvoices key={`invoices-${selectedSpace.id}`} spaceId={selectedSpace.id} /><StripeConnectSetup key={selectedSpace.id} spaces={[selectedSpace]} /></div></section>}
          {activeManagementSection === 'settings' && <SpaceManagement key={`settings-${selectedSpace.id}`} section="settings" spaceId={selectedSpace.id} onChanged={() => setAttempt(n => n + 1)} />}
        </div>
      </div>
      </>}
    </div>}
    {view === 'requests' && <div className="workspace-panel">
      {!data.owner && <p className="workspace-description">Starter permet 1 espace et jusqu’à 2 groupes ; Pro permet jusqu’à 2 espaces et 4 groupes par espace.</p>}
      <SpaceRequests owner={data.owner} mode={data.owner ? 'all' : 'combined'} onChanged={() => setAttempt(n => n + 1)} />
    </div>}
    {view === 'projects' && <div className="workspace-panel">
    <section aria-labelledby="my-projects-title">
      <div className="account-section-heading"><h2 className="sr-only" id="my-projects-title">Mes projets</h2><span>{data.projects.length} projet{data.projects.length > 1 ? 's' : ''}</span></div>
      {submittedNotice && <p className="account-notice" role="status">{submittedNotice}</p>}
      {editing === null && data.spaces.length > 0 && <button className="button coral workspace-create" onClick={() => setEditing('new')}>Créer un projet <Icon name="arrow" /></button>}
      {editing !== null && <DraftEditor key={editing} id={editing} spaces={data.spaces} groups={data.groups} onClose={() => setEditing(null)} onSubmitted={project => {
        setData(current => current && ({ ...current, projects: [project, ...current.projects.filter(p => p.id !== project.id)] }));
        setEditing(null); setFilter('ALL'); setHighlightProjectId(project.id); setSubmittedNotice(project.status === 'APPROUVE' ? 'Projet approuvé. Ouvrez « Publications » dans votre espace pour le rendre visible à tous.' : `Projet soumis. ${stageLabel(project.reviewStage)}. Il n’est pas publié. Retrouvez-le ci-dessous dans « Mes projets ».`);
      }} onSaved={draft => {
        setFilter('ALL'); setHighlightProjectId(draft.id);
        setData(current => current && ({ ...current, projects: [{ id: draft.id, title: draft.title, status: draft.status, spaceName: draft.spaceName }, ...current.projects.filter(p => p.id !== draft.id)] }));
      }} />}
      {data.projects.length > 0 && <label className="workspace-filter">Statut des projets<select value={filter} onChange={event => { setFilter(event.target.value); setProjectPage(0); }}><option value="ALL">Tous ({data.projects.length})</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label} ({data.projects.filter(p => p.status === value).length})</option>)}</select></label>}
      {!data.projects.length ? <div className="workspace-card"><h3>Vos idées ont leur place ici</h3><p>Vous n’avez pas encore créé de projet. {data.spaces.length ? 'Commencez par enregistrer une idée en brouillon privé.' : 'Une appartenance active à un espace organisateur est nécessaire pour créer un projet.'}</p></div> : projects.length ? <><div className="workspace-grid">{projects.slice(projectPage * 12, (projectPage + 1) * 12).map(project => <article key={project.id} id={`projet-${project.id}`} className={`workspace-card${highlightProjectId === project.id ? ' workspace-card--new' : ''}`}><span className="account-status">{project.status === 'SOUMIS' ? stageLabel(project.reviewStage) : statuses[project.status] ?? project.status}</span><h3>{project.title}</h3><p>{project.spaceName} · Projet #{project.id}</p>{project.status === 'APPROUVE' && <><p className="workspace-muted">{project.published ? 'Publié et visible selon sa visibilité.' : 'Approuvé, pas encore publié.'}</p>{project.published ? <a className="text-link workspace-resume" href={`/projets/${project.id}`}>Voir le projet <Icon name="arrow" /></a> : project.spaceId && data.spaces.some(space => space.id === project.spaceId && space.role === 'ADMINISTRATEUR') ? <a className="text-link workspace-resume" href={`/mon-espace?espace=${project.spaceId}&rubrique=project-publications#organisation`}>Publier le projet <Icon name="arrow" /></a> : null}</>}{(project.status === 'BROUILLON' || project.status === 'A_CORRIGER') && <><p className="workspace-muted">{project.status === 'A_CORRIGER' ? 'Des corrections ont été demandées. Consultez les remarques avant de soumettre à nouveau.' : 'Ce brouillon reste visible uniquement par vous.'}</p><button className="text-link workspace-resume" disabled={editing !== null} onClick={() => setEditing(project.id)}>{project.status === 'A_CORRIGER' ? 'Consulter les remarques et corriger' : 'Ouvrir le brouillon'} <Icon name="arrow" /></button></>}{['SOUMIS', 'APPROUVE', 'REFUSE'].includes(project.status) && <><button className="text-link workspace-resume" aria-expanded={openedSubmission === project.id} onClick={() => setOpenedSubmission(openedSubmission === project.id ? null : project.id)}>{openedSubmission === project.id ? 'Masquer le projet' : project.status === 'SOUMIS' ? 'Consulter le projet soumis' : 'Consulter la décision'}</button>{openedSubmission === project.id && <SubmittedDetail id={project.id} />}</>}</article>)}</div>{projects.length > 12 && <div className="management-actions"><button className="button outline" disabled={projectPage === 0} onClick={() => setProjectPage(value => value - 1)}>Précédent</button><span>Page {projectPage + 1} sur {Math.ceil(projects.length / 12)}</span><button className="button outline" disabled={(projectPage + 1) * 12 >= projects.length} onClick={() => setProjectPage(value => value + 1)}>Suivant</button></div>}</> : <p className="account-empty">Aucun projet avec ce statut.</p>}
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
