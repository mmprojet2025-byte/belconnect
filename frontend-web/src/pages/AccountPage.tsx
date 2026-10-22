import { ProjectParticipations } from '../components/ProjectParticipations';
import { useEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import type { FormEvent } from "react";
import { postJson } from "../lib/auth";
import type { UserProfile } from "../lib/auth";
import { MyWorkspace } from "../components/MyWorkspace";
import { MyBookings } from "../components/MyBookings";
import { AccountNotifications } from "../components/AccountNotifications";
import { MyDonations } from "../components/MyDonations";
import { MyPaidProjectParticipations } from "../components/PaidProjectParticipation";
import { PaidActivityReturn } from "../components/PaidActivityReturn";
import { Icon } from "../components/Icon";
import { navigate, useLocation } from "../lib/navigation";
import { confirmLeavingEditor, useUnsavedChanges } from "../lib/unsavedChanges";
import "./Enrollment.css";
import "./AccountPage.css";

export function AccountPage({ user, onLogout, onProfileSaved }: { user: UserProfile; onLogout: () => Promise<void>; onProfileSaved: (profile: UserProfile) => void }) {
  const location = useLocation();
  const acceptedLocation = useRef(location);
  useEffect(() => { acceptedLocation.current = location; }, [location]);
  useEffect(() => {
    const guard = (event: PopStateEvent) => {
      if (!event.isTrusted) return;
      const destination = window.location.pathname + window.location.search + window.location.hash;
      if (destination === acceptedLocation.current || confirmLeavingEditor()) { acceptedLocation.current = destination; return; }
      window.history.pushState(null, '', acceptedLocation.current);
      event.stopImmediatePropagation();
    };
    window.addEventListener('popstate', guard, true);
    return () => window.removeEventListener('popstate', guard, true);
  }, []);
  const hash = location.split('#')[1];
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isReferent, setIsReferent] = useState(false);
  const [canManageTasks, setCanManageTasks] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [canCreateActivity, setCanCreateActivity] = useState(false);
  const stripeReturn = new URLSearchParams(location.split('?')[1]?.split('#')[0]).has('stripe');
  const selectedSpaceId = Number(new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('espace')) || null;
  const selectedRubrique = new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('rubrique');
  const createActivity = new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('creation') === 'activite';
  const highlightActivityId = Number(new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('activite')) || null;
  const section = hash === 'notifications' ? 'notifications' : hash === 'mon-profil' ? 'profile'
    : isOwner ? hash === 'espaces' ? 'owner-spaces' : hash === 'suivi-belconnect' ? 'owner' : hash === 'demandes' ? 'requests' : hash === 'a-traiter' ? 'inbox' : 'dashboard'
    : hash === 'a-traiter' ? 'inbox' : hash === 'mes-activites' || createActivity ? 'activities' : hash === 'organisation' ? 'management' : hash === 'espaces' || stripeReturn ? 'spaces' : hash === 'mes-projets' ? 'projects'
    : hash === 'demandes' ? 'requests' : ['mes-inscriptions', 'participations-projets', 'aides-projets'].includes(hash) ? 'personal' : 'dashboard';
  const participationTab = hash === 'participations-projets' ? 'projects' : hash === 'aides-projets' ? 'helps' : 'activities';
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => setHeaderTarget(document.getElementById('account-header-tools'))); return () => cancelAnimationFrame(frame); }, []);
  const profileMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (profileMenu.current && !profileMenu.current.contains(event.target as Node)) profileMenu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && profileMenu.current?.open) { profileMenu.current.open = false; profileMenu.current.querySelector('summary')?.focus(); } };
    document.addEventListener('click', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { const close = () => { if (window.innerWidth <= 760) setSidebarOpen(false); }; window.addEventListener('belconnect:close-account-menu', close); return () => window.removeEventListener('belconnect:close-account-menu', close); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Accès indisponible'); return response.json(); })
      .then((value: { owner: boolean; spaces: { id: number; role: string }[]; groups: { spaceId: number; role: string; canManageActivities: boolean; canManageMemberships: boolean }[] }) => {
        if (controller.signal.aborted) return;
        setIsOwner(value.owner);
        setIsOrganizer(!value.owner && value.spaces.some(space => space.role === 'ADMINISTRATEUR'));
        setIsReferent(!value.owner && value.groups.some(group => group.role === 'REFERENT'));
        setCanManageTasks(!value.owner && (value.spaces.some(space => space.role === 'ADMINISTRATEUR') || value.groups.some(group => group.role === 'REFERENT' || group.canManageMemberships)));
        setCanCreateActivity(!value.owner && (value.spaces.some(space => space.role === 'ADMINISTRATEUR') || value.groups.some(group => group.canManageActivities)));
      })
      .catch(() => { if (!controller.signal.aborted) setIsOwner(false); });
    return () => controller.abort();
  }, [user.id]);
  useEffect(() => {
    if (isOwner === null) return;
    let active = true;
    const refresh = () => Promise.all([
      isOwner ? Promise.resolve([]) : fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.ok ? response.json() : []),
      fetch('/api/workspace/notifications', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.ok ? response.json() : []),
      isOwner ? Promise.resolve([]) : fetch('/api/group-memberships/notifications', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.ok ? response.json() : []),
    ]).then(([activities, spaces, groups]) => { if (active) setNotificationCount(activities.length + spaces.length + groups.length); }).catch(() => {});
    const onCount = (event: Event) => setNotificationCount((event as CustomEvent<number>).detail);
    void refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('belconnect:notifications-changed', refresh);
    window.addEventListener('belconnect:notification-count', onCount);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('belconnect:notifications-changed', refresh); window.removeEventListener('belconnect:notification-count', onCount); };
  }, [isOwner, user.id]);
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector(hash === 'notifications' ? '#notifications' : hash === 'aides-projets' && isOwner === false ? '#aides-projets' : '.account-main')?.scrollIntoView?.());
  }, [hash, isOwner]);
  function openSection(next: string) {
    if (window.innerWidth <= 760) setSidebarOpen(false);
    navigate(`/mon-espace#${next}`);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  useUnsavedChanges(section === 'profile' && (firstName !== user.firstName || lastName !== user.lastName));
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileBusy) return;
    setProfileBusy(true); setProfileError(""); setProfileNotice("");
    try {
      const profile: UserProfile = await postJson('/api/auth/profile', { firstName: firstName.trim(), lastName: lastName.trim() });
      onProfileSaved(profile);
      setFirstName(profile.firstName); setLastName(profile.lastName);
      setProfileNotice('Vos coordonnées ont été enregistrées.');
    } catch (cause) { setProfileError(cause instanceof Error ? cause.message : 'Enregistrement impossible. Réessayez.'); }
    finally { setProfileBusy(false); }
  }
  async function logout() {
    if (!confirmLeavingEditor()) return;
    setBusy(true); setError("");
    try { await onLogout(); }
    catch { setError("La déconnexion a échoué. Réessayez."); }
    finally { setBusy(false); }
  }
  const headerControls = <div className="account-toolbar-actions" aria-label="Outils du compte">
    <a className="account-toolbar-notifications" href="/mon-espace#notifications" aria-label={`Notifications${notificationCount ? `, ${notificationCount} non lues` : ''}`} aria-current={section === 'notifications' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('notifications'); }}><Icon name="bell" />{notificationCount > 0 && <span className="account-toolbar-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}</a>
    <details className="account-profile-menu" ref={profileMenu}><summary aria-label="Ouvrir le profil" title="Profil">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</summary><div className="account-profile-popover"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span><small>{isOwner ? 'Propriétaire de Belconnect' : isOrganizer ? 'Organisateur' : isReferent ? 'Référent' : 'Membre'}</small><a href="/mon-espace#mon-profil" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('mon-profil'); }}>Mon profil</a><button disabled={busy} onClick={() => { if (profileMenu.current) profileMenu.current.open = false; void logout(); }}>{busy ? 'Déconnexion…' : 'Se déconnecter'}</button>{error && <p role="alert">{error}</p>}</div></details>
  </div>;
  const sidebarToggle = <button className="account-sidebar-toggle" type="button" aria-label={sidebarOpen ? 'Fermer le menu de mon espace' : 'Ouvrir le menu de mon espace'} aria-controls="account-side-nav" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(open => !open)}><Icon name="sidebar" /></button>;
  return <section className="account-page" data-sidebar-open={sidebarOpen} onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest('a[href]') && !confirmLeavingEditor()) {
      event.preventDefault(); event.stopPropagation();
    }
  }}>
    {sidebarOpen && <button className="account-sidebar-backdrop" type="button" aria-label="Fermer le volet de navigation" onClick={() => setSidebarOpen(false)} />}
    {headerTarget ? createPortal(headerControls, headerTarget) : <div className="account-tools-fallback">{headerControls}</div>}
    <div className="container">
      <h1 className="sr-only">Mon espace</h1>
      <div className="account-layout">
        <div className="account-main">
          {isOwner === null ? <p role="status">Chargement de vos accès…</p> : <>
            {!isOwner && <PaidActivityReturn userId={user.id} />}
            {section === 'notifications' && <AccountNotifications key={user.id} owner={isOwner} onOpenBookings={() => openSection('mes-inscriptions')} onOpenRequests={() => openSection(isOwner ? 'a-traiter' : 'demandes')} />}
            {['dashboard', 'inbox', 'spaces', 'activities', 'management', 'projects', 'requests', 'owner', 'owner-spaces'].includes(section) && <MyWorkspace key={`${user.id}-${section}-${selectedSpaceId ?? ''}-${selectedRubrique ?? ''}`} firstName={user.firstName} selectedSpaceId={selectedSpaceId} selectedRubrique={selectedRubrique} createActivity={createActivity} highlightActivityId={highlightActivityId} view={section === 'dashboard' ? 'dashboard' : section === 'inbox' ? 'inbox' : section === 'spaces' ? 'spaces' : section === 'activities' ? 'activities' : section === 'management' ? 'management' : section === 'projects' ? 'projects' : section === 'owner-spaces' ? 'owner-spaces' : section === 'owner' ? 'owner' : 'requests'} onOwnerChange={setIsOwner} onOrganizerChange={setIsOrganizer} onReferentChange={setIsReferent} onActivityAccessChange={setCanCreateActivity} onTaskAccessChange={setCanManageTasks} />}
            {section === 'profile' && <div className="account-welcome account-profile-main"><div><h2>Mon profil</h2><p>Modifiez vos coordonnées ci-dessous.</p></div><form className="account-profile-form" onSubmit={saveProfile}><label>Prénom<input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label>Nom<input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} /></label><p>Adresse e-mail : {user.email}</p><button className="button outline" disabled={profileBusy || !firstName.trim() || !lastName.trim()}>{profileBusy ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}</button>{profileError && <p role="alert">{profileError}</p>}{profileNotice && <p role="status">{profileNotice}</p>}</form></div>}
            {section === 'personal' && <div id="mes-inscriptions"><div className="account-welcome"><span className="account-welcome-icon"><Icon name="calendar" /></span><div><h2>Mes participations</h2><p>Retrouvez vos activités, contributions et aides aux projets.</p></div></div><nav className="account-participation-nav" aria-label="Types de participation"><a href="#mes-inscriptions" aria-current={participationTab === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}>Activités</a><a href="#participations-projets" aria-current={participationTab === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('participations-projets'); }}>Projets et dons</a><a href="#aides-projets" aria-current={participationTab === 'helps' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('aides-projets'); }}>Aides proposées</a></nav>{participationTab === 'activities' && <><MyBookings key={`bookings-${user.id}`} userId={user.id} /><p className="account-demo-note"><Icon name="ticket" /> Certaines activités du catalogue sont des exemples. Leur fiche indique quand le paiement est une simulation.</p></>}{participationTab === 'projects' && <div id="participations-projets"><MyPaidProjectParticipations key={`paid-projects-${user.id}`} userId={user.id} /><MyDonations key={`donations-${user.id}`} /></div>}{participationTab === 'helps' && <ProjectParticipations key={`helps-${user.id}`} />}</div>}
          </>}
        </div>
        <aside className="account-sidebar" aria-label="Navigation de mon espace">
          <section className="account-profile">
            <div className="account-sidebar-top"><span>Mon espace</span>{sidebarToggle}</div>
            <nav id="account-side-nav" className="account-side-nav" data-open={sidebarOpen} aria-label="Navigation de mon espace">
              {isOwner !== null && <a href="#accueil" title="Tableau de bord" aria-current={section === 'dashboard' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('accueil'); }}><Icon name="home" /><span className="account-nav-text">Tableau de bord</span></a>}
              {isOwner === null ? <span role="status">Chargement du menu…</span> : isOwner ? <>
                <span className="account-nav-label">Gérer Belconnect</span>
                <a href="#a-traiter" title="À traiter" aria-current={section === 'inbox' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('a-traiter'); }}><Icon name="inbox" /><span className="account-nav-text">À traiter</span></a>
                <a href="#espaces" title="Espaces organisateurs" aria-current={section === 'owner-spaces' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /><span className="account-nav-text">Espaces organisateurs</span></a>
                <a href="#suivi-belconnect" title="Suivi de Belconnect" aria-current={section === 'owner' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('suivi-belconnect'); }}><Icon name="chart" /><span className="account-nav-text">Suivi de Belconnect</span></a>
              </> : <>
                {canManageTasks && <a href="#a-traiter" title="À traiter" aria-current={section === 'inbox' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('a-traiter'); }}><Icon name="inbox" /><span className="account-nav-text">À traiter</span></a>}
                <span className="account-nav-label">Participer</span>
                <a href="#mes-inscriptions" title="Mes participations" aria-current={section === 'personal' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}><Icon name="ticket" /><span className="account-nav-text">Mes participations</span></a>
                <span className="account-nav-label">Mes espaces</span>
                {canCreateActivity && <a href="#mes-activites" title="Mes activités" aria-current={section === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-activites'); }}><Icon name="calendar" /><span className="account-nav-text">Mes activités</span></a>}
                <a href="#espaces" title="Espaces et groupes" aria-current={section === 'spaces' || section === 'management' && !createActivity ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /><span className="account-nav-text">Espaces et groupes</span></a>
                <div id="workspace-sidebar-slot" className="workspace-sidebar-slot" />
                <a href="#mes-projets" title="Mes projets" aria-current={section === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-projets'); }}><Icon name="folder" /><span className="account-nav-text">Mes projets</span></a>
                <a href="#demandes" title="Mes demandes" aria-current={section === 'requests' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('demandes'); }}><Icon name="document" /><span className="account-nav-text">Mes demandes</span></a>
              </>}
            </nav>
          </section>

        </aside>
      </div>
    </div>
  </section>;
}
