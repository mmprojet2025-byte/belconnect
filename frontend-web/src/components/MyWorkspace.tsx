import { ManagedActivities } from './ManagedActivities';
import { GroupMembers } from './GroupMembers';
import { GroupMemberships } from './GroupMemberships';
import { GroupAnnouncements } from './GroupAnnouncements';
import { StripeConnectSetup } from './StripeConnectSetup';
import { SpaceInvoices } from './SpaceInvoices';
import { SpaceSubscriptions } from './SpaceSubscriptions';
import { SpaceManagement, SpaceRequests } from './SpaceManagement';
import { ProjectParticipations } from './ProjectParticipations';
import { ProjectPublications } from './ProjectPublications';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  projects: { id: number; title: string; status: string; spaceName: string; reviewStage?: string | null }[];
  managedSpaces: Space[];
  suspendedSpaces: { id: number; name: string; reason: string }[];
  moderationNotices: { spaceName: string; action: string; contentName: string; reason: string }[];
};
const statuses: Record<string, string> = { BROUILLON: 'Brouillon privé', SOUMIS: 'Soumis', A_CORRIGER: 'À corriger', APPROUVE: 'Approuvé', REFUSE: 'Refusé', TERMINE: 'Terminé' };

export function MyWorkspace({ view = 'spaces', firstName = '', selectedSpaceId, selectedRubrique, createActivity = false, highlightActivityId, onOwnerChange, onOrganizerChange, onReferentChange, onActivityAccessChange, onTaskAccessChange }: { view?: 'dashboard' | 'inbox' | 'spaces' | 'activities' | 'management' | 'projects' | 'requests' | 'owner' | 'owner-spaces'; firstName?: string; selectedSpaceId?: number | null; selectedRubrique?: string | null; createActivity?: boolean; highlightActivityId?: number | null; onOwnerChange?: (owner: boolean) => void; onOrganizerChange?: (organizer: boolean) => void; onReferentChange?: (referent: boolean) => void; onActivityAccessChange?: (allowed: boolean) => void; onTaskAccessChange?: (allowed: boolean) => void }) {
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
  const [spacesTab, setSpacesTab] = useState<'spaces' | 'groups'>('spaces');
  const [requestsTab, setRequestsTab] = useState<'memberships' | 'spaces' | 'new'>('memberships');
  useEffect(() => {
    if (view === 'management' && !selectedSpaceId) navigate('/mon-espace#espaces', true);
  }, [view, selectedSpaceId]);
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
  const sidebarTarget = view === 'management' ? document.getElementById('workspace-sidebar-slot') : null;
  const contextNavigation = selectedSpace && <nav className="workspace-context-nav" aria-label={`Gérer ${selectedSpace.name}`}>
    <span className="account-nav-label">{selectedSpace.name}</span>
    {(isSpaceAdmin || selectedGroups.length > 0) && <button aria-current={activeManagementSection === 'groups' ? 'page' : undefined} onClick={() => changeManagementSection('groups')}>Groupes</button>}
    {canManageMembers && <button aria-current={activeManagementSection === 'memberships' ? 'page' : undefined} onClick={() => changeManagementSection('memberships')}>Demandes d’adhésion</button>}
    {selectedGroups.some(group => group.role === 'ADMINISTRATEUR' || group.role === 'REFERENT') && <button aria-current={activeManagementSection === 'announcements' ? 'page' : undefined} onClick={() => changeManagementSection('announcements')}>Annonces</button>}
    {canReviewProjects && <><span className="account-nav-label">Projets</span><button aria-current={activeManagementSection === 'project-reviews' ? 'page' : undefined} onClick={() => changeManagementSection('project-reviews')}>À examiner</button></>}
    {isSpaceAdmin && <><button aria-current={activeManagementSection === 'project-publications' ? 'page' : undefined} onClick={() => changeManagementSection('project-publications')}>Publications</button><button aria-current={activeManagementSection === 'project-helps' ? 'page' : undefined} onClick={() => changeManagementSection('project-helps')}>Aides reçues</button><span className="account-nav-label">Administration</span><button aria-current={activeManagementSection === 'payments' ? 'page' : undefined} onClick={() => changeManagementSection('payments')}>Paiements</button><button aria-current={activeManagementSection === 'settings' ? 'page' : undefined} onClick={() => changeManagementSection('settings')}>Réglages</button></>}
  </nav>;
  return <div className="workspace-sections">
    {error && <p className="draft-error" role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Actualiser</button></p>}
    {view === 'dashboard' && <WorkspaceDashboard data={data} firstName={firstName} refreshToken={attempt} onRefresh={() => setAttempt(value => value + 1)} />}
    {view === 'inbox' && (data.owner ? <SpaceRequests owner onChanged={() => setAttempt(n => n + 1)} mode="inbox" /> : manageableSpaces.length ? <WorkQueue /> : <div className="account-empty"><h3>Aucune tâche de gestion</h3><p>Les décisions confiées à un administrateur ou à un référent apparaîtront ici.</p></div>)}
    {['owner', 'owner-spaces'].includes(view) && <div className="workspace-intro"><h2>{view === 'owner-spaces' ? 'Espaces organisateurs' : 'Pilotage de la plateforme'}</h2><p>{view === 'owner' ? 'Indicateurs de la plateforme en mode test.' : 'Consultez les espaces et intervenez en cas de signalement.'}</p></div>}
    {view === 'spaces' && <div className="workspace-panel">
    {data.suspendedSpaces?.map(space => <div className="account-notice" role="status" key={space.id}><strong>{space.name} : espace suspendu par Belconnect.</strong> Les nouveaux accès publics, inscriptions et paiements sont arrêtés. {space.reason && <>Motif : {space.reason}</>} Contactez l’assistance pour demander un réexamen. Les réservations déjà payées restent à traiter. <button className="text-link" onClick={() => navigate(`/mon-espace?espace=${space.id}#organisation`)}>Traiter les réservations et remboursements</button></div>)}
    {data.moderationNotices?.map((notice, index) => <div className="account-notice" role="status" key={`${notice.spaceName}-${notice.contentName}-${index}`}><strong>{notice.contentName} est masqué par Belconnect.</strong> Espace : {notice.spaceName}. Motif : {notice.reason}. Les réservations déjà payées restent à traiter ; contactez l’assistance pour demander un réexamen.</div>)}
    <section aria-labelledby="workspace-title">
      <div className="account-section-heading"><h2 id="workspace-title">Mes espaces et groupes</h2><span>{data.spaces.length} espace{data.spaces.length > 1 ? 's' : ''}</span></div>
      <p className="workspace-description">Consultez vos accès ici. Les demandes d’ouverture et d’adhésion sont dans « Mes demandes ».</p>
      <nav className="workspace-management-nav" aria-label="Voir mes accès"><button aria-pressed={spacesTab === 'spaces'} onClick={() => setSpacesTab('spaces')}>Espaces ({data.spaces.length})</button><button aria-pressed={spacesTab === 'groups'} onClick={() => setSpacesTab('groups')}>Groupes ({data.groups.length})</button></nav>
      {spacesTab === 'spaces' && (!data.spaces.length ? <div className="account-empty"><span><Icon name="users" /></span><h3>Aucun espace pour le moment</h3><p>{data.suspendedSpaces?.length ? 'Un espace suspendu figure ci-dessus. Contactez l’assistance pour demander un réexamen.' : 'Vous pouvez rejoindre un groupe ou demander l’ouverture d’un espace organisateur.'}</p>{!data.suspendedSpaces?.length && <div className="booking-actions"><a className="button outline" href="/groupes">Découvrir les groupes <Icon name="arrow" /></a><a className="button outline" href="/mon-espace#demandes">Demander un espace <Icon name="arrow" /></a></div>}</div> :
        <div className="workspace-grid">{data.spaces.map(space => <article className="workspace-card" key={space.id}>
          <span className="account-status">{space.role === 'ADMINISTRATEUR' ? 'Administrateur d’espace' : 'Membre de l’espace'}</span><h3>{space.name}</h3>
          <p className="workspace-muted">{data.groups.filter(group => group.spaceId === space.id).length} groupe{data.groups.filter(group => group.spaceId === space.id).length > 1 ? 's' : ''} lié{data.groups.filter(group => group.spaceId === space.id).length > 1 ? 's' : ''} à votre compte</p>
          {manageableSpaces.some(item => item.id === space.id) && <button className="button outline workspace-resume" onClick={() => chooseSpace(space.id)}>{space.role === 'ADMINISTRATEUR' ? 'Gérer cet espace' : 'Voir mes tâches de référent'}</button>}
        </article>)}</div>)}
      {spacesTab === 'groups' && (data.groups.length ? <div className="workspace-grid">{data.groups.map(group => <article className="workspace-card" key={group.id}><span className="account-status">{group.role === 'GESTION_ESPACE' ? 'Géré via l’espace' : group.role === 'ADMINISTRATEUR' ? 'Administrateur du groupe' : group.role === 'REFERENT' ? 'Référent du groupe' : 'Membre du groupe'}</span><h3>{group.name}</h3><p>{data.spaces.find(space => space.id === group.spaceId)?.name ?? 'Espace organisateur'}</p>{group.role === 'REFERENT' && <p className="workspace-muted">Projets et annonces{group.canManageMemberships ? ' · Adhésions' : ''}{group.canManageActivities ? ' · Activités' : ''}</p>}<a className="text-link workspace-resume" href={`/groupes?groupe=${group.id}`}>Voir le groupe →</a></article>)}</div> : <div className="account-empty"><h3>Aucun groupe pour le moment</h3><p>Découvrez les groupes et demandez à rejoindre celui qui vous intéresse.</p><a className="button outline" href="/groupes">Découvrir les groupes <Icon name="arrow" /></a></div>)}
    </section>
    </div>}
    {view === 'activities' && <div className="workspace-panel">{activitySpaces.length ? <ManagedActivities key={createActivity ? 'create' : 'list'} spaces={activitySpaces} groups={data.groups.filter(group => group.canManageActivities)} startCreating={createActivity} highlightId={highlightActivityId} onCreationFinished={id => navigate(id ? `/mon-espace?activite=${id}#mes-activites` : '/mon-espace#mes-activites', true)} /> : <div className="account-empty"><h3>Aucune activité à gérer</h3><p>Vous devez administrer un espace ou être autorisé à gérer les activités d’un groupe.</p><a href="/mon-espace#espaces">Voir mes espaces</a></div>}</div>}
    {view === 'management' && <div className="workspace-panel">
      {!selectedSpaceId && <a className="text-link" href="/mon-espace#espaces">← Retour à mes espaces</a>}
      {selectedSuspendedSpace ? <section aria-label="Obligations d’un espace suspendu"><div className="account-section-heading"><h2>{selectedSuspendedSpace.name} · suspendu</h2></div><p className="account-notice">Seules la consultation des inscriptions et la régularisation des annulations ou remboursements restent possibles. Contactez l’assistance pour demander un réexamen.</p><ManagedActivities spaces={[{ id: selectedSuspendedSpace.id, name: selectedSuspendedSpace.name, role: 'ADMINISTRATEUR' }]} groups={[]} settlementOnly /><ProjectPublications spaceId={selectedSuspendedSpace.id} settlementOnly /></section> : !selectedSpace ? <p role="status">Retour à mes espaces…</p> : <>
      <header className="workspace-context-header">
        <div className="workspace-context-heading"><span className="workspace-context-symbol"><Icon name="users" /></span><div><span className="workspace-context-kicker">Espace organisateur</span><h2>{selectedSpace.name}</h2><p>{isSpaceAdmin ? 'Vous administrez cet espace.' : 'Vous gérez les rubriques autorisées de vos groupes.'}</p></div></div>
        <div className="workspace-context-header-actions"><span className="workspace-context-role">{isSpaceAdmin ? 'Administrateur' : 'Référent'}</span><button className="button outline" onClick={() => { if (canLeaveActivityCreation()) navigate('/mon-espace#espaces'); }}>Retour à mes espaces</button></div>
        <div className="workspace-context-location" aria-label="Rubrique actuelle"><span>Gestion de l’espace</span><Icon name="chevron" /><strong>{managementLabels[activeManagementSection]}</strong></div>
      </header>
      <div className="workspace-management-layout">
        {contextNavigation && (sidebarTarget ? createPortal(contextNavigation, sidebarTarget) : contextNavigation)}
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
      {!data.owner && <div className="workspace-intro"><h2>Mes demandes</h2><p>Suivez ici vos demandes et les réponses reçues. Un membre peut rejoindre jusqu’à 2 groupes. Pour organiser, la formule Starter permet 1 espace et jusqu’à 2 groupes par espace ; la formule Pro permet jusqu’à 3 espaces et 4 groupes par espace.</p></div>}
      {!data.owner ? <div className="requests-layout">
        <nav className="requests-side-nav" aria-label="Type de demande">
          <button aria-current={requestsTab === 'memberships' ? 'page' : undefined} onClick={() => setRequestsTab('memberships')}>Adhésions aux groupes</button>
          <button aria-current={requestsTab === 'spaces' ? 'page' : undefined} onClick={() => setRequestsTab('spaces')}>Ouverture d’espace</button>
          <button aria-current={requestsTab === 'new' ? 'page' : undefined} onClick={() => setRequestsTab('new')}>Fiche de demande</button>
        </nav>
        <div className="requests-content">{requestsTab === 'memberships' ? <GroupMemberships onChanged={() => setAttempt(n => n + 1)} /> : <SpaceRequests owner={false} mode={requestsTab === 'new' ? 'create' : 'list'} onChanged={() => setAttempt(n => n + 1)} onCreated={() => setRequestsTab('spaces')} onCancelCreate={() => setRequestsTab('spaces')} />}</div>
      </div> : <SpaceRequests owner mode="all" onChanged={() => setAttempt(n => n + 1)} />}
    </div>}
    {view === 'projects' && <div className="workspace-panel">
    <section aria-labelledby="my-projects-title">
      <div className="account-section-heading"><h2 id="my-projects-title">Mes projets</h2><span>{data.projects.length} projet{data.projects.length > 1 ? 's' : ''}</span></div>
      {submittedNotice && <p className="account-notice" role="status">{submittedNotice}</p>}
      {editing === null && data.spaces.length > 0 && <button className="button coral workspace-create" onClick={() => setEditing('new')}>Créer un projet <Icon name="arrow" /></button>}
      {editing !== null && <DraftEditor key={editing} id={editing} spaces={data.spaces} groups={data.groups} onClose={() => setEditing(null)} onSubmitted={project => {
        setData(current => current && ({ ...current, projects: [project, ...current.projects.filter(p => p.id !== project.id)] }));
        setEditing(null); setFilter('ALL'); setHighlightProjectId(project.id); setSubmittedNotice(`Projet soumis. ${stageLabel(project.reviewStage)}. Il n’est pas publié. Retrouvez-le ci-dessous dans « Mes projets ».`);
      }} onSaved={draft => {
        setFilter('ALL'); setHighlightProjectId(draft.id);
        setData(current => current && ({ ...current, projects: [{ id: draft.id, title: draft.title, status: draft.status, spaceName: draft.spaceName }, ...current.projects.filter(p => p.id !== draft.id)] }));
      }} />}
      {data.projects.length > 0 && <label className="workspace-filter">Statut des projets<select value={filter} onChange={event => { setFilter(event.target.value); setProjectPage(0); }}><option value="ALL">Tous ({data.projects.length})</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label} ({data.projects.filter(p => p.status === value).length})</option>)}</select></label>}
      {!data.projects.length ? <div className="workspace-card"><h3>Vos idées ont leur place ici</h3><p>Vous n’avez pas encore créé de projet. {data.spaces.length ? 'Commencez par enregistrer une idée en brouillon privé.' : 'Une appartenance active à un espace organisateur est nécessaire pour créer un projet.'}</p></div> : projects.length ? <><div className="workspace-grid">{projects.slice(projectPage * 12, (projectPage + 1) * 12).map(project => <article key={project.id} id={`projet-${project.id}`} className={`workspace-card${highlightProjectId === project.id ? ' workspace-card--new' : ''}`}><span className="account-status">{project.status === 'SOUMIS' ? stageLabel(project.reviewStage) : statuses[project.status] ?? project.status}</span><h3>{project.title}</h3><p>{project.spaceName} · Projet #{project.id}</p>{(project.status === 'BROUILLON' || project.status === 'A_CORRIGER') && <><p className="workspace-muted">{project.status === 'A_CORRIGER' ? 'Des corrections ont été demandées. Consultez les remarques avant de soumettre à nouveau.' : 'Ce brouillon reste visible uniquement par vous.'}</p><button className="text-link workspace-resume" disabled={editing !== null} onClick={() => setEditing(project.id)}>{project.status === 'A_CORRIGER' ? 'Consulter les remarques et corriger' : 'Ouvrir le brouillon'} <Icon name="arrow" /></button></>}{['SOUMIS', 'APPROUVE', 'REFUSE'].includes(project.status) && <><button className="text-link workspace-resume" aria-expanded={openedSubmission === project.id} onClick={() => setOpenedSubmission(openedSubmission === project.id ? null : project.id)}>{openedSubmission === project.id ? 'Masquer le projet' : project.status === 'SOUMIS' ? 'Consulter le projet soumis' : 'Consulter la décision'}</button>{openedSubmission === project.id && <SubmittedDetail id={project.id} />}</>}</article>)}</div>{projects.length > 12 && <div className="management-actions"><button className="button outline" disabled={projectPage === 0} onClick={() => setProjectPage(value => value - 1)}>Précédent</button><span>Page {projectPage + 1} sur {Math.ceil(projects.length / 12)}</span><button className="button outline" disabled={(projectPage + 1) * 12 >= projects.length} onClick={() => setProjectPage(value => value + 1)}>Suivant</button></div>}</> : <p className="account-empty">Aucun projet avec ce statut.</p>}
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
