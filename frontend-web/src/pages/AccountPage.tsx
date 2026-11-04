import { OwnerStatistics } from "../components/OwnerStatistics";
import { OwnerContactFeedback } from "../components/OwnerContactFeedback";
import { OwnerSecurityLog } from "../components/OwnerSecurityLog";
import { OwnerSecurityGate } from "../components/OwnerSecurityGate";
import { MyPaymentDocuments } from '../components/MyPaymentDocuments';
import { OrganizerGuide } from '../components/OrganizerGuide';
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
  const [managedMenuSpaces,setManagedMenuSpaces]=useState<{id:number;name:string}[]>([]);
  const [isReferent, setIsReferent] = useState(false);
  const [, setCanManageTasks] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [canCreateActivity, setCanCreateActivity] = useState(false);
  const stripeReturn = new URLSearchParams(location.split('?')[1]?.split('#')[0]).has('stripe');
  const selectedSpaceId = Number(new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('espace')) || null;
  const selectedRubrique = new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('rubrique');
  const createActivity = new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('creation') === 'activite';
  const highlightActivityId = Number(new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('activite')) || null;
  const section = hash === 'guide' ? 'guide' : hash === 'notifications' ? 'notifications' : hash === 'mon-profil' ? 'profile' : hash === 'reglages-compte' ? 'account-settings'
    : isOwner ? hash === 'retours-recus' ? 'owner-feedback' : hash === 'statistiques' ? 'owner-statistics' : hash === 'securite' ? 'security' : hash === 'espaces' ? 'owner-spaces' : hash === 'suivi-belconnect' ? 'owner' : hash === 'abonnements-factures' ? 'owner-billing' : hash === 'membres-roles' ? 'owner-members' : hash === 'demandes' ? 'requests' : hash === 'a-traiter' ? 'inbox' : 'dashboard'
    : hash === 'a-traiter' ? 'inbox' : hash === 'mes-activites' || createActivity ? 'activities' : hash === 'organisation' ? 'management' : hash === 'espaces' || stripeReturn ? 'spaces' : hash === 'mes-projets' ? 'projects'
    : hash === 'demandes' ? 'requests' : ['mes-inscriptions', 'participations-projets', 'aides-projets', 'mes-factures', 'groupes'].includes(hash) ? 'personal' : 'dashboard';
  const participationTab = hash === 'groupes' ? 'groups' : hash === 'mes-factures' ? 'invoices' : hash === 'participations-projets' ? 'projects' : hash === 'aides-projets' ? 'helps' : 'activities';
  const mainScrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const main=mainScrollRef.current;if(typeof main?.scrollTo==='function')main.scrollTo({top:0});},[section,location]);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [profileTarget, setProfileTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => { setHeaderTarget(document.getElementById('account-header-tools')); setProfileTarget(document.getElementById('account-header-profile')); }); return () => cancelAnimationFrame(frame); }, []);
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
      .then((value: { owner: boolean; spaces: { id: number; name:string; role: string }[]; groups: { spaceId: number; role: string; canManageActivities: boolean; canManageMemberships: boolean }[] }) => {
        if (controller.signal.aborted) return;
        setIsOwner(value.owner);
        setManagedMenuSpaces(value.owner?[]:value.spaces.filter(space=>space.role==='ADMINISTRATEUR').map(space=>({id:space.id,name:space.name})));
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
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteBusy || !deletePassword || !window.confirm(t('Supprimer définitivement votre compte Belconnect ?', 'Permanently delete your Belconnect account?', 'Uw Belconnect-account definitief verwijderen?'))) return;
    setDeleteBusy(true); setDeleteError('');
    try { await postJson('/api/auth/delete', { password: deletePassword }); window.location.assign('/'); }
    catch (cause) { setDeleteError(cause instanceof Error ? cause.message : t('Suppression impossible.', 'Could not delete the account.', 'Account verwijderen mislukt.')); setDeleteBusy(false); }
  }
  const notificationsControl = <a className="account-toolbar-notifications" href="/mon-espace#notifications" aria-label={`${t('Notifications', 'Notifications', 'Meldingen')}${notificationCount ? `, ${notificationCount} ${t('non lues', 'unread', 'ongelezen')}` : ''}`} aria-current={section === 'notifications' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('notifications'); }}><Icon name="bell" />{notificationCount > 0 && <span className="account-toolbar-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>}</a>;
  const profileControl = <details className="account-profile-menu" ref={profileMenu}><summary aria-label={t('Ouvrir le profil', 'Open profile', 'Profiel openen')} title={t('Profil', 'Profile', 'Profiel')}><span className="account-menu-avatar">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</span><Icon name="chevron" className="account-menu-chevron" /></summary><div className="account-profile-popover"><div className="account-profile-identity"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span><small>{isOwner ? t('Propriétaire de Belconnect', 'Belconnect owner', 'Eigenaar van Belconnect') : isOrganizer ? t('Organisateur', 'Organiser', 'Organisator') : isReferent ? t('Référent', 'Group lead', 'Groepsverantwoordelijke') : t('Membre', 'Member', 'Lid')}</small></div><a href="/mon-espace#mon-profil" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('mon-profil'); }}><Icon name="users" />{t('Mon profil', 'My profile', 'Mijn profiel')}</a><a href="/mon-espace#reglages-compte" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('reglages-compte'); }}><Icon name="tools" />{t('Réglages du compte', 'Account settings', 'Accountinstellingen')}</a><a href="/mon-espace#guide" onClick={event => { event.preventDefault(); if (profileMenu.current) profileMenu.current.open = false; openSection('guide'); }}><Icon name="document" />{t('Guide organisateur', 'Organiser guide', 'Organisatorgids')}</a><a href="/contact" onClick={() => { if (profileMenu.current) profileMenu.current.open = false; }}><Icon name="heart" />{t('Donner mon avis', 'Share feedback', 'Feedback geven')}</a><button disabled={busy} onClick={() => { if (profileMenu.current) profileMenu.current.open = false; void logout(); }}><Icon name="arrow" />{busy ? t('Déconnexion…', 'Signing out…', 'Afmelden…') : t('Se déconnecter', 'Sign out', 'Afmelden')}</button>{error && <p role="alert">{error}</p>}</div></details>;
  const sidebarToggle = <button className="account-sidebar-toggle" type="button" aria-label={sidebarOpen ? t('Fermer le menu de mon espace', 'Close my space menu', 'Menu van mijn ruimte sluiten') : t('Ouvrir le menu de mon espace', 'Open my space menu', 'Menu van mijn ruimte openen')} aria-controls="account-side-nav" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(open => !open)}><Icon name="sidebar" /></button>;
  return <section className="account-page" data-owner={isOwner===true} data-sidebar-open={sidebarOpen} onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest('a[href]') && !confirmLeavingEditor()) {
      event.preventDefault(); event.stopPropagation();
    }
  }}>
    {sidebarOpen && <button className="account-sidebar-backdrop" type="button" aria-label={t('Fermer le volet de navigation', 'Close navigation panel', 'Navigatiepaneel sluiten')} onClick={() => setSidebarOpen(false)} />}
    {headerTarget && profileTarget ? <>{createPortal(notificationsControl, headerTarget)}{createPortal(profileControl, profileTarget)}</> : <div className="account-tools-fallback">{notificationsControl}{profileControl}</div>}
    <div className="container">
      <h1 className="sr-only">{t('Mon espace', 'My space', 'Mijn ruimte')}</h1>
      <div className="account-layout">
        <div className="account-main" ref={mainScrollRef} tabIndex={isOwner?0:undefined} aria-label={isOwner?'Contenu de la rubrique':undefined}>
          {isOwner === null ? <p role="status">{t('Chargement de vos accès…', 'Loading your access…', 'Uw toegang wordt geladen…')}</p> : <>
            {!isOwner && <PaidActivityReturn userId={user.id} />}
            {section === 'security' && isOwner && <div className="workspace-card"><OwnerSecurityLog /></div>}
            {section === 'guide' && <OrganizerGuide owner={isOwner === true} />}
            {section === 'notifications' && <AccountNotifications key={user.id} owner={isOwner} onOpenBookings={() => openSection('mes-inscriptions')} onOpenRequests={() => openSection(isOwner ? 'a-traiter' : 'demandes')} />}
            {['dashboard', 'inbox', 'spaces', 'groups', 'activities', 'management', 'projects', 'requests', 'owner', 'owner-spaces'].includes(section) && <MyWorkspace key={user.id} firstName={user.firstName} userId={user.id} selectedSpaceId={selectedSpaceId} selectedRubrique={selectedRubrique} createActivity={createActivity} highlightActivityId={highlightActivityId} view={section === 'dashboard' ? 'dashboard' : section === 'inbox' ? 'inbox' : section === 'spaces' ? 'spaces' : section === 'activities' ? 'activities' : section === 'management' ? 'management' : section === 'projects' ? 'projects' : section === 'owner-spaces' ? 'owner-spaces' : section === 'owner' ? 'owner' : 'requests'} onOwnerChange={setIsOwner} onOrganizerChange={setIsOrganizer} onReferentChange={setIsReferent} onActivityAccessChange={setCanCreateActivity} onTaskAccessChange={setCanManageTasks} />}
            {section === 'owner-statistics' && isOwner && <OwnerStatistics />}
            {section === 'owner-feedback' && isOwner && <OwnerContactFeedback />}
            {section === 'owner-billing' && <OwnerBilling />}
            {section === 'owner-members' && <OwnerMembers />}
            {section === 'profile' && <div className="account-welcome account-profile-main"><div className="account-profile-heading"><span className="account-profile-avatar" aria-hidden="true">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</span><div><span className="workspace-context-kicker">{t('Mon compte', 'My account', 'Mijn account')}</span><h2>{user.firstName} {user.lastName}</h2><p>{user.email}</p></div></div><div className="account-profile-section"><h3>{t('Mes coordonnées', 'My details', 'Mijn gegevens')}</h3><p>{t('Modifiez le nom affiché sur votre profil.', 'Update the name shown on your profile.', 'Wijzig de naam op uw profiel.')}</p><form className="account-profile-form" onSubmit={saveProfile}><label>{t('Prénom', 'First name', 'Voornaam')}<input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label>{t('Nom', 'Last name', 'Achternaam')}<input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} /></label><button className="button outline" disabled={profileBusy || !firstName.trim() || !lastName.trim()}>{profileBusy ? t('Enregistrement…', 'Saving…', 'Opslaan…') : t('Enregistrer mes coordonnées', 'Save my details', 'Mijn gegevens opslaan')}</button>{profileError && <p role="alert">{profileError}</p>}{profileNotice && <p role="status">{profileNotice}</p>}</form></div><a className="account-settings-link" href="/mon-espace#reglages-compte" onClick={event => { event.preventDefault(); openSection('reglages-compte'); }}>{t('Réglages et confidentialité du compte', 'Account settings and privacy', 'Accountinstellingen en privacy')} →</a></div>}
            {section === 'account-settings' && isOwner && <OwnerSecurityGate manage />}
            {section === 'account-settings' && <div className="account-welcome account-settings-main"><div><span className="workspace-context-kicker">{t('Mon compte', 'My account', 'Mijn account')}</span><h2>{t('Réglages du compte', 'Account settings', 'Accountinstellingen')}</h2><p>{t('Retrouvez vos informations de confidentialité et les actions sur votre compte.', 'Find privacy information and account actions.', 'Bekijk privacyinformatie en accountacties.')}</p></div><div className="account-settings-section"><h3>{t('Confidentialité et RGPD', 'Privacy and GDPR', 'Privacy en AVG')}</h3><p>{t('Consultez les informations disponibles sur vos données personnelles et les règles d’utilisation. Ces documents sont encore des brouillons pour la version locale.', 'Read the available information on personal data and usage rules. These documents are still drafts for the local version.', 'Lees de beschikbare informatie over persoonsgegevens en gebruiksregels. Deze documenten zijn nog concepten voor de lokale versie.')}</p><a href="/informations-legales#confidentialite">{t('Voir la confidentialité et mes droits', 'Privacy and my rights', 'Privacy en mijn rechten')} →</a><a href="/informations-legales#conditions">{t('Voir les règles d’utilisation', 'Usage rules', 'Gebruiksregels')} →</a></div><div className="account-settings-section account-settings-danger"><h3>{t('Supprimer mon compte', 'Delete my account', 'Mijn account verwijderen')}</h3><p>{t('Cette action désactive votre accès et anonymise le profil. Certaines contributions déjà partagées et données de paiement peuvent être conservées. Si vous gérez un espace, transférez ou fermez d’abord vos responsabilités.', 'This disables access and anonymizes your profile. Some shared contributions and payment records may be retained. If you manage a space, transfer or close your responsibilities first.', 'Dit beëindigt uw toegang en anonimiseert uw profiel. Gedeelde bijdragen en betaalgegevens kunnen bewaard blijven. Draag eerst uw verantwoordelijkheden over of sluit uw ruimte.')}</p><button type="button" className="text-link" onClick={() => { setShowDelete(value => !value); setDeleteError(''); }}>{showDelete ? t('Fermer', 'Close', 'Sluiten') : t('Demander la suppression', 'Request deletion', 'Verwijdering aanvragen')}</button>{showDelete && <form className="account-delete-form" onSubmit={deleteAccount}><label>{t('Mot de passe pour confirmer', 'Password to confirm', 'Wachtwoord ter bevestiging')}<input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} required /></label><button className="button outline" disabled={deleteBusy || !deletePassword}>{deleteBusy ? t('Suppression…', 'Deleting…', 'Verwijderen…') : t('Supprimer définitivement mon compte', 'Permanently delete my account', 'Mijn account definitief verwijderen')}</button>{deleteError && <p role="alert">{deleteError}</p>}</form>}</div></div>}
            {section === 'personal' && <div id="mes-inscriptions">
              <header className="workspace-context-header">
                <div className="workspace-context-heading"><span className="workspace-context-symbol"><Icon name="calendar" /></span><div><span className="workspace-context-kicker">{t('Mon espace', 'My space', 'Mijn ruimte')}</span><h2>{t('Mes participations', 'My registrations', 'Mijn deelnames')}</h2><p>{t('Retrouvez vos activités, contributions et aides aux projets.', 'Find your activities, project registrations and offers of help.', 'Bekijk uw activiteiten, projectinschrijvingen en aangeboden hulp.')}</p></div></div>
                <nav className="workspace-context-location" aria-label={t('Chemin des participations', 'Participation path', 'Pad van deelnames')}><span>{t('Mon espace', 'My space', 'Mijn ruimte')}</span><Icon name="chevron" /><span>{t('Mes participations', 'My registrations', 'Mijn deelnames')}</span><Icon name="chevron" /><strong aria-current="page">{participationTab === 'groups' ? t('Groupes', 'Groups', 'Groepen') : participationTab === 'activities' ? t('Activités', 'Activities', 'Activiteiten') : participationTab === 'projects' ? t('Projets et dons', 'Projects and donations', 'Projecten en giften') : participationTab === 'invoices' ? t('Mes factures', 'My invoices', 'Mijn facturen') : t('Aides proposées', 'Offers of help', 'Aangeboden hulp')}</strong></nav>
              </header>
              <nav className="account-participation-nav" aria-label={t('Types de participation', 'Types of participation', 'Soorten deelname')}><a href="#mes-inscriptions" aria-current={participationTab === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}>{t('Activités', 'Activities', 'Activiteiten')}</a><a href="#participations-projets" aria-current={participationTab === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('participations-projets'); }}>{t('Projets et dons', 'Projects and donations', 'Projecten en giften')}</a><a href="#aides-projets" aria-current={participationTab === 'helps' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('aides-projets'); }}>{t('Aides proposées', 'Offers of help', 'Aangeboden hulp')}</a><a href="#mes-factures" aria-current={participationTab === 'invoices' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-factures'); }}>{t('Mes factures', 'My invoices', 'Mijn facturen')}</a><a href="#groupes" aria-current={participationTab === 'groups' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('groupes'); }}>{t('Groupes', 'Groups', 'Groepen')}</a></nav>
              {participationTab === 'activities' && <><MyBookings key={`bookings-${user.id}`} userId={user.id} /><p className="account-demo-note"><Icon name="ticket" /> {t('Certaines activités du catalogue sont des exemples. Leur fiche indique quand le paiement est une simulation.', 'Some catalogue activities are examples. Their pages indicate when payment is simulated.', 'Sommige activiteiten in de catalogus zijn voorbeelden. Hun pagina vermeldt wanneer de betaling gesimuleerd wordt.')}</p></>}
              {participationTab === 'projects' && <div id="participations-projets"><MyPaidProjectParticipations key={`paid-projects-${user.id}`} userId={user.id} /><MyDonations key={`donations-${user.id}`} /></div>}
              {participationTab === 'invoices' && <MyPaymentDocuments key={`documents-${user.id}`} />}
              {participationTab === 'groups' && <MyWorkspace view="groups" memberGroupsOnly userId={user.id} />}
              {participationTab === 'helps' && <ProjectParticipations key={`helps-${user.id}`} />}
            </div>}
          </>}
        </div>
        <aside className="account-sidebar" aria-label={t('Navigation de mon espace', 'My space navigation', 'Navigatie in mijn ruimte')}>
          <section className="account-profile">
            <div className="account-sidebar-top"><span>{t('Mon espace', 'My space', 'Mijn ruimte')}</span>{sidebarToggle}</div>
            <nav id="account-side-nav" className="account-side-nav" data-open={sidebarOpen} aria-label={t('Navigation de mon espace', 'My space navigation', 'Navigatie in mijn ruimte')}>
              {isOwner !== null && <a href="#accueil" title={t('Tableau de bord', 'Dashboard', 'Dashboard')} aria-current={section === 'dashboard' || (section === 'requests' || section === 'inbox') && !isOwner ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('accueil'); }}><Icon name="home" /><span className="account-nav-text">{t('Tableau de bord', 'Dashboard', 'Dashboard')}</span></a>}
              {isOwner === null ? <span role="status">{t('Chargement du menu…', 'Loading menu…', 'Menu wordt geladen…')}</span> : isOwner ? <>
                <span className="account-nav-label">{t('Gérer Belconnect', 'Manage Belconnect', 'Belconnect beheren')}</span>
                <a href="#a-traiter" title={t('Demandes d’espace', 'Space requests', 'Ruimteaanvragen')} aria-current={section === 'inbox' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('a-traiter'); }}><Icon name="inbox" /><span className="account-nav-text">{t('Demandes d’espace', 'Space requests', 'Ruimteaanvragen')}</span></a>
                <a href="/mon-espace#espaces" title={t('Espaces organisateurs', 'Organiser spaces', 'Organisatieruimtes')} aria-current={section === 'owner-spaces' && !location.includes('alerte=signalements') ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /><span className="account-nav-text">{t('Espaces organisateurs', 'Organiser spaces', 'Organisatieruimtes')}</span></a>
                <a href="/mon-espace?alerte=signalements#espaces" aria-current={section === 'owner-spaces' && location.includes('alerte=signalements') ? 'page' : undefined} onClick={event => { event.preventDefault(); if (window.innerWidth <= 760) setSidebarOpen(false); navigate('/mon-espace?alerte=signalements#espaces'); }}><Icon name="chat" /><span className="account-nav-text">{t('Signalements', 'Reports', 'Meldingen')}</span></a>
                <a href="#retours-recus" title={t('Retours reçus', 'Received feedback', 'Ontvangen feedback')} aria-current={section === 'owner-feedback' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('retours-recus'); }}><Icon name="chat" /><span className="account-nav-text">{t('Retours reçus', 'Received feedback', 'Ontvangen feedback')}</span></a>
                <details className="account-nav-group" key={['owner','owner-statistics','owner-billing'].includes(section)?'finance-active':'finance-rest'} open={['owner','owner-statistics','owner-billing'].includes(section)}><summary title={t('Finances', 'Finance', 'Financiën')}><Icon name="chart" /><span className="account-nav-text">{t('Finances', 'Finance', 'Financiën')}</span></summary><div>
                <a href="#statistiques" aria-current={section === 'owner-statistics' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('statistiques'); }}><Icon name="chart" /><span className="account-nav-text">{t('Statistiques', 'Statistics', 'Statistieken')}</span></a>
                <a href="#suivi-belconnect" title={t('Paiements et commissions', 'Payments and commissions', 'Betalingen en commissies')} aria-current={section === 'owner' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('suivi-belconnect'); }}><Icon name="chart" /><span className="account-nav-text">{t('Paiements et commissions', 'Payments and commissions', 'Betalingen en commissies')}</span></a>
                <a href="#abonnements-factures" title={t('Abonnements et factures', 'Subscriptions and invoices', 'Abonnementen en facturen')} aria-current={section === 'owner-billing' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('abonnements-factures'); }}><Icon name="ticket" /><span className="account-nav-text">{t('Abonnements et factures', 'Subscriptions and invoices', 'Abonnementen en facturen')}</span></a>
                </div></details>
                <a href="#membres-roles" title={t('Membres et rôles', 'Members and roles', 'Leden en rollen')} aria-current={section === 'owner-members' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('membres-roles'); }}><Icon name="users" /><span className="account-nav-text">{t('Membres et rôles', 'Members and roles', 'Leden en rollen')}</span></a>
                <a href="#securite" title={t('Sécurité', 'Security', 'Beveiliging')} aria-current={section === 'security' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('securite'); }}><Icon name="document" /><span className="account-nav-text">{t('Sécurité', 'Security', 'Beveiliging')}</span></a>
              </> : <>
                <span className="account-nav-label">{t('Participer', 'Participate', 'Deelnemen')}</span>
                <a href="#mes-inscriptions" title={t('Mes participations', 'My registrations', 'Mijn deelnames')} aria-current={section === 'personal' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}><Icon name="ticket" /><span className="account-nav-text">{t('Mes participations', 'My registrations', 'Mijn deelnames')}</span></a>
                <span className="account-nav-label">{t('Organiser', 'Organise', 'Organiseren')}</span>
                {canCreateActivity && <a href="#mes-activites" title={t('Mes activités', 'My activities', 'Mijn activiteiten')} aria-current={section === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-activites'); }}><Icon name="calendar" /><span className="account-nav-text">{t('Mes activités', 'My activities', 'Mijn activiteiten')}</span></a>}
                <details className="account-nav-group" open={section==='spaces'||section==='management'}><summary title={t('Mes espaces', 'My spaces', 'Mijn ruimtes')}><Icon name="users" /><span className="account-nav-text">{t('Mes espaces', 'My spaces', 'Mijn ruimtes')}</span></summary><div><a href="/mon-espace#espaces" aria-current={section==='spaces'?'page':undefined} onClick={event=>{event.preventDefault();openSection('espaces');}}><span className="account-nav-text">Tous mes espaces</span></a>{managedMenuSpaces.map(space=><a key={space.id} href={`/mon-espace?espace=${space.id}#organisation`} aria-current={section==='management'&&selectedSpaceId===space.id?'page':undefined} onClick={event=>{event.preventDefault();if(window.innerWidth<=760)setSidebarOpen(false);navigate(`/mon-espace?espace=${space.id}#organisation`);}}><span className="account-nav-text">{space.name}</span></a>)}</div></details>
                <a href="#mes-projets" title={t('Mes projets', 'My projects', 'Mijn projecten')} aria-current={section === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-projets'); }}><Icon name="folder" /><span className="account-nav-text">{t('Mes projets', 'My projects', 'Mijn projecten')}</span></a>
              </>}
            </nav>
          </section>

        </aside>
      </div>
    </div>
  </section>;
}
