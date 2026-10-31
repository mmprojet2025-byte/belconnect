import { ProjectParticipations } from '../components/ProjectParticipations';
import { useEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import type { FormEvent } from "react";
import { postJson } from "../lib/auth";
import type { UserProfile } from "../lib/auth";
import { MyWorkspace } from "../components/MyWorkspace";
import { OwnerBilling } from "../components/OwnerBilling";
import { OwnerMembers } from "../components/OwnerMembers";
import { MyBookings } from "../components/MyBookings";
import { AccountNotifications } from "../components/AccountNotifications";
import { MyDonations } from "../components/MyDonations";
import { MyPaidProjectParticipations } from "../components/PaidProjectParticipation";
import { PaidActivityReturn } from "../components/PaidActivityReturn";
import { Icon } from "../components/Icon";
import { navigate, useLocation } from "../lib/navigation";
import { confirmLeavingEditor, useUnsavedChanges } from "../lib/unsavedChanges";
import { tr, useLocale } from '../lib/locale';
import "./Enrollment.css";
import "./AccountPage.css";

export function AccountPage({ user, onLogout, onProfileSaved }: { user: UserProfile; onLogout: () => Promise<void>; onProfileSaved: (profile: UserProfile) => void }) {
  const locale = useLocale();
  const t = (fr: string, en: string, nl: string) => tr(locale, fr, en, nl);
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
    : isOwner ? hash === 'espaces' ? 'owner-spaces' : hash === 'suivi-belconnect' ? 'owner' : hash === 'abonnements-factures' ? 'owner-billing' : hash === 'membres-roles' ? 'owner-members' : hash === 'demandes' ? 'requests' : hash === 'a-traiter' ? 'inbox' : 'dashboard'
    : hash === 'a-traiter' ? 'inbox' : hash === 'mes-activites' || createActivity ? 'activities' : hash === 'organisation' ? 'management' : hash === 'espaces' || stripeReturn ? 'spaces' : hash === 'groupes' ? 'groups' : hash === 'mes-projets' ? 'projects'
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
    const refresh = () => fetch('/api/notifications/count', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => { if (!response.ok) throw new Error('Notifications indisponibles'); return response.json(); })
      .then((value: { unread: number }) => { if (active) setNotificationCount(value.unread); }).catch(() => {});
    void refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('belconnect:notifications-changed', refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('belconnect:notifications-changed', refresh); };
  }, [isOwner, user.id]);
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
      setProfileNotice(t('Vos coordonnées ont été enregistrées.', 'Your details have been saved.', 'Uw gegevens zijn opgeslagen.'));
    } catch (cause) { setProfileError(cause instanceof Error ? cause.message : t('Enregistrement impossible. Réessayez.', 'Could not save. Try again.', 'Opslaan mislukt. Probeer opnieuw.')); }
    finally { setProfileBusy(false); }
  }
  async function logout() {
    if (!confirmLeavingEditor()) return;
    setBusy(true); setError("");
    try { await onLogout(); }
    catch { setError(t('La déconnexion a échoué. Réessayez.', 'Sign-out failed. Try again.', 'Afmelden mislukt. Probeer opnieuw.')); }
    finally { setBusy(false); }
  }
  const headerControls = <div className="account-toolbar-actions" aria-label={t('Outils du compte', 'Account tools', 'Accounttools')}>
    <a className="account-toolbar-notifications" href="/mon-espace#notifications" aria-label={`${t('Notifications', 'Notifications', 'Meldingen')}${notificationCount ? `, ${notificationCount} ${t('non lues', 'unread', 'ongelezen')}` : ''}`} aria-current={section === 'notifications' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('notifications'); }}><Icon name="bell" />{notificationCount > 0 && <span className="account-toolbar-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}</a>
    <details className="account-profile-menu" ref={profileMenu}><summary aria-label={t('Ouvrir le profil', 'Open profile', 'Profiel openen')} title={t('Profil', 'Profile', 'Profiel')}>{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</summary><div className="account-profile-popover"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span><small>{isOwner ? t('Propriétaire de Belconnect', 'Belconnect owner', 'Eigenaar van Belconnect') : isOrganizer ? t('Organisateur', 'Organiser', 'Organisator') : isReferent ? t('Référent', 'Group lead', 'Groepsverantwoordelijke') : t('Membre', 'Member', 'Lid')}</small><a href="/mon-espace#mon-profil" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('mon-profil'); }}>{t('Mon profil', 'My profile', 'Mijn profiel')}</a><button disabled={busy} onClick={() => { if (profileMenu.current) profileMenu.current.open = false; void logout(); }}>{busy ? t('Déconnexion…', 'Signing out…', 'Afmelden…') : t('Se déconnecter', 'Sign out', 'Afmelden')}</button>{error && <p role="alert">{error}</p>}</div></details>
  </div>;
  const sidebarToggle = <button className="account-sidebar-toggle" type="button" aria-label={sidebarOpen ? t('Fermer le menu de mon espace', 'Close my space menu', 'Menu van mijn ruimte sluiten') : t('Ouvrir le menu de mon espace', 'Open my space menu', 'Menu van mijn ruimte openen')} aria-controls="account-side-nav" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(open => !open)}><Icon name="sidebar" /></button>;
  return <section className="account-page" data-sidebar-open={sidebarOpen} onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest('a[href]') && !confirmLeavingEditor()) {
      event.preventDefault(); event.stopPropagation();
    }
  }}>
    {sidebarOpen && <button className="account-sidebar-backdrop" type="button" aria-label={t('Fermer le volet de navigation', 'Close navigation panel', 'Navigatiepaneel sluiten')} onClick={() => setSidebarOpen(false)} />}
    {headerTarget ? createPortal(headerControls, headerTarget) : <div className="account-tools-fallback">{headerControls}</div>}
    <div className="container">
      <h1 className="sr-only">{t('Mon espace', 'My space', 'Mijn ruimte')}</h1>
      <div className="account-layout">
        <div className="account-main">
          {isOwner === null ? <p role="status">{t('Chargement de vos accès…', 'Loading your access…', 'Uw toegang wordt geladen…')}</p> : <>
            {!isOwner && <PaidActivityReturn userId={user.id} />}
            {section === 'notifications' && <AccountNotifications key={user.id} owner={isOwner} onOpenBookings={() => openSection('mes-inscriptions')} onOpenRequests={() => openSection(isOwner ? 'a-traiter' : 'demandes')} />}
            {['dashboard', 'inbox', 'spaces', 'groups', 'activities', 'management', 'projects', 'requests', 'owner', 'owner-spaces'].includes(section) && <MyWorkspace key={user.id} firstName={user.firstName} selectedSpaceId={selectedSpaceId} selectedRubrique={selectedRubrique} createActivity={createActivity} highlightActivityId={highlightActivityId} view={section === 'dashboard' ? 'dashboard' : section === 'inbox' ? 'inbox' : section === 'spaces' ? 'spaces' : section === 'groups' ? 'groups' : section === 'activities' ? 'activities' : section === 'management' ? 'management' : section === 'projects' ? 'projects' : section === 'owner-spaces' ? 'owner-spaces' : section === 'owner' ? 'owner' : 'requests'} onOwnerChange={setIsOwner} onOrganizerChange={setIsOrganizer} onReferentChange={setIsReferent} onActivityAccessChange={setCanCreateActivity} onTaskAccessChange={setCanManageTasks} />}
            {section === 'owner-billing' && <OwnerBilling />}
            {section === 'owner-members' && <OwnerMembers />}
            {section === 'profile' && <div className="account-welcome account-profile-main"><div><h2>{t('Mon profil', 'My profile', 'Mijn profiel')}</h2><p>{t('Modifiez vos coordonnées ci-dessous.', 'Update your details below.', 'Wijzig hieronder uw gegevens.')}</p></div><form className="account-profile-form" onSubmit={saveProfile}><label>{t('Prénom', 'First name', 'Voornaam')}<input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label>{t('Nom', 'Last name', 'Achternaam')}<input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} /></label><p>{t('Adresse e-mail', 'Email address', 'E-mailadres')} : {user.email}</p><button className="button outline" disabled={profileBusy || !firstName.trim() || !lastName.trim()}>{profileBusy ? t('Enregistrement…', 'Saving…', 'Opslaan…') : t('Enregistrer mes coordonnées', 'Save my details', 'Mijn gegevens opslaan')}</button>{profileError && <p role="alert">{profileError}</p>}{profileNotice && <p role="status">{profileNotice}</p>}</form></div>}
            {section === 'personal' && <div id="mes-inscriptions"><div className="account-welcome"><span className="account-welcome-icon"><Icon name="calendar" /></span><div><h2>{t('Mes participations', 'My registrations', 'Mijn deelnames')}</h2><p>{t('Retrouvez vos activités, contributions et aides aux projets.', 'Find your activities, project registrations and offers of help.', 'Bekijk uw activiteiten, projectinschrijvingen en aangeboden hulp.')}</p></div></div><nav className="account-participation-nav" aria-label={t('Types de participation', 'Types of participation', 'Soorten deelname')}><a href="#mes-inscriptions" aria-current={participationTab === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}>{t('Activités', 'Activities', 'Activiteiten')}</a><a href="#participations-projets" aria-current={participationTab === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('participations-projets'); }}>{t('Projets et dons', 'Projects and donations', 'Projecten en giften')}</a><a href="#aides-projets" aria-current={participationTab === 'helps' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('aides-projets'); }}>{t('Aides proposées', 'Offers of help', 'Aangeboden hulp')}</a></nav>{participationTab === 'activities' && <><MyBookings key={`bookings-${user.id}`} userId={user.id} /><p className="account-demo-note"><Icon name="ticket" /> {t('Certaines activités du catalogue sont des exemples. Leur fiche indique quand le paiement est une simulation.', 'Some catalogue activities are examples. Their pages indicate when payment is simulated.', 'Sommige activiteiten in de catalogus zijn voorbeelden. Hun pagina vermeldt wanneer de betaling gesimuleerd wordt.')}</p></>}{participationTab === 'projects' && <div id="participations-projets"><MyPaidProjectParticipations key={`paid-projects-${user.id}`} userId={user.id} /><MyDonations key={`donations-${user.id}`} /></div>}{participationTab === 'helps' && <ProjectParticipations key={`helps-${user.id}`} />}</div>}
          </>}
        </div>
        <aside className="account-sidebar" aria-label={t('Navigation de mon espace', 'My space navigation', 'Navigatie in mijn ruimte')}>
          <section className="account-profile">
            <div className="account-sidebar-top"><span>{t('Mon espace', 'My space', 'Mijn ruimte')}</span>{sidebarToggle}</div>
            <nav id="account-side-nav" className="account-side-nav" data-open={sidebarOpen} aria-label={t('Navigation de mon espace', 'My space navigation', 'Navigatie in mijn ruimte')}>
              {isOwner !== null && <a href="#accueil" title={t('Tableau de bord', 'Dashboard', 'Dashboard')} aria-current={section === 'dashboard' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('accueil'); }}><Icon name="home" /><span className="account-nav-text">{t('Tableau de bord', 'Dashboard', 'Dashboard')}</span></a>}
              {isOwner === null ? <span role="status">{t('Chargement du menu…', 'Loading menu…', 'Menu wordt geladen…')}</span> : isOwner ? <>
                <span className="account-nav-label">{t('Gérer Belconnect', 'Manage Belconnect', 'Belconnect beheren')}</span>
                <a href="#a-traiter" title={t('Demandes d’espace', 'Space requests', 'Ruimteaanvragen')} aria-current={section === 'inbox' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('a-traiter'); }}><Icon name="inbox" /><span className="account-nav-text">{t('Demandes d’espace', 'Space requests', 'Ruimteaanvragen')}</span></a>
                <a href="#espaces" title={t('Espaces organisateurs', 'Organiser spaces', 'Organisatieruimtes')} aria-current={section === 'owner-spaces' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /><span className="account-nav-text">{t('Espaces organisateurs', 'Organiser spaces', 'Organisatieruimtes')}</span></a>
                <a href="#suivi-belconnect" title={t('Suivi de Belconnect', 'Belconnect overview', 'Belconnect-overzicht')} aria-current={section === 'owner' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('suivi-belconnect'); }}><Icon name="chart" /><span className="account-nav-text">{t('Suivi de Belconnect', 'Belconnect overview', 'Belconnect-overzicht')}</span></a>
                <a href="#abonnements-factures" title={t('Abonnements et factures', 'Subscriptions and invoices', 'Abonnementen en facturen')} aria-current={section === 'owner-billing' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('abonnements-factures'); }}><Icon name="ticket" /><span className="account-nav-text">{t('Abonnements et factures', 'Subscriptions and invoices', 'Abonnementen en facturen')}</span></a>
                <a href="#membres-roles" title={t('Membres et rôles', 'Members and roles', 'Leden en rollen')} aria-current={section === 'owner-members' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('membres-roles'); }}><Icon name="users" /><span className="account-nav-text">{t('Membres et rôles', 'Members and roles', 'Leden en rollen')}</span></a>
              </> : <>
                {canManageTasks && <a href="#a-traiter" title={t('Demandes à examiner', 'Requests to review', 'Aanvragen te beoordelen')} aria-current={section === 'inbox' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('a-traiter'); }}><Icon name="inbox" /><span className="account-nav-text">{t('Demandes à examiner', 'Requests to review', 'Aanvragen te beoordelen')}</span></a>}
                <span className="account-nav-label">{t('Participer', 'Participate', 'Deelnemen')}</span>
                <a href="#mes-inscriptions" title={t('Mes participations', 'My registrations', 'Mijn deelnames')} aria-current={section === 'personal' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}><Icon name="ticket" /><span className="account-nav-text">{t('Mes participations', 'My registrations', 'Mijn deelnames')}</span></a>
                <span className="account-nav-label">{t('Organiser', 'Organise', 'Organiseren')}</span>
                {canCreateActivity && <a href="#mes-activites" title={t('Mes activités', 'My activities', 'Mijn activiteiten')} aria-current={section === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-activites'); }}><Icon name="calendar" /><span className="account-nav-text">{t('Mes activités', 'My activities', 'Mijn activiteiten')}</span></a>}
                <a href="#espaces" title={t('Mes espaces', 'My spaces', 'Mijn ruimtes')} aria-current={section === 'spaces' || section === 'management' && !createActivity ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /><span className="account-nav-text">{t('Mes espaces', 'My spaces', 'Mijn ruimtes')}</span></a>
                <a href="#groupes" title={t('Mes groupes', 'My groups', 'Mijn groepen')} aria-current={section === 'groups' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('groupes'); }}><Icon name="users" /><span className="account-nav-text">{t('Mes groupes', 'My groups', 'Mijn groepen')}</span></a>
                <a href="#mes-projets" title={t('Mes projets', 'My projects', 'Mijn projecten')} aria-current={section === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-projets'); }}><Icon name="folder" /><span className="account-nav-text">{t('Mes projets', 'My projects', 'Mijn projecten')}</span></a>
                <a href="#demandes" title={t('Mes demandes', 'My requests', 'Mijn aanvragen')} aria-current={section === 'requests' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('demandes'); }}><Icon name="document" /><span className="account-nav-text">{t('Mes demandes', 'My requests', 'Mijn aanvragen')}</span></a>
              </>}
            </nav>
          </section>

        </aside>
      </div>
    </div>
  </section>;
}
