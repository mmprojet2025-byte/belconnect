import { ProjectParticipations } from '../components/ProjectParticipations';
import { useEffect, useRef, useState } from "react";
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
  const [canCreateActivity, setCanCreateActivity] = useState(false);
  const stripeReturn = new URLSearchParams(location.split('?')[1]?.split('#')[0]).has('stripe');
  const selectedSpaceId = Number(new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('espace')) || null;
  const createActivity = new URLSearchParams(location.split('?')[1]?.split('#')[0]).get('creation') === 'activite';
  const section = hash === 'notifications' ? 'notifications' : hash === 'mon-profil' ? 'profile'
    : isOwner ? hash === 'espaces' ? 'owner-spaces' : hash === 'suivi-belconnect' ? 'owner' : 'requests'
    : hash === 'organisation' ? 'management' : hash === 'espaces' || stripeReturn ? 'spaces' : hash === 'mes-projets' ? 'projects'
    : hash === 'demandes' ? 'requests' : 'personal';
  const participationTab = hash === 'participations-projets' ? 'projects' : hash === 'aides-projets' ? 'helps' : 'activities';
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Accès indisponible'); return response.json(); })
      .then((value: { owner: boolean; spaces: { id: number; role: string }[]; groups: { spaceId: number; canManageActivities: boolean }[] }) => {
        if (controller.signal.aborted) return;
        setIsOwner(value.owner);
        setCanCreateActivity(!value.owner && (value.spaces.some(space => space.role === 'ADMINISTRATEUR') || value.groups.some(group => group.canManageActivities)));
      })
      .catch(() => { if (!controller.signal.aborted) setIsOwner(false); });
    return () => controller.abort();
  }, [user.id]);
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector(hash === 'notifications' ? '#notifications' : hash === 'aides-projets' && isOwner === false ? '#aides-projets' : '.account-heading')?.scrollIntoView?.());
  }, [hash, isOwner]);
  function openSection(next: string) {
    setMenuOpen(false);
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
  return <section className="account-page" onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest('a[href]') && !confirmLeavingEditor()) {
      event.preventDefault(); event.stopPropagation();
    }
  }}>
    <div className="container">
      <div className="account-breadcrumb"><a href="/">Accueil</a><span aria-hidden="true">/</span><span>Mon espace</span></div>
      <div className="account-heading"><div><p className="eyebrow teal">{isOwner ? 'PILOTAGE BELCONNECT' : 'VOTRE COIN BELCONNECT'}</p><h1 tabIndex={-1}>Bonjour {user.firstName || user.lastName} <span className="account-dot">!</span></h1><p>{isOwner ? 'Suivez la plateforme et examinez les demandes d’ouverture d’espace.' : 'Vos prochaines découvertes commencent ici.'}</p></div>{isOwner === false && <a className="button coral" href="/activites">Trouver une activité <Icon name="arrow" /></a>}</div>
      <div className="account-layout">
        <div className="account-main">
          {isOwner === null ? <p role="status">Chargement de vos accès…</p> : <>
            {!isOwner && <PaidActivityReturn userId={user.id} />}
            {section === 'notifications' && <AccountNotifications key={user.id} owner={isOwner} onOpenBookings={() => openSection('mes-inscriptions')} onOpenRequests={() => openSection('demandes')} />}
            {['spaces', 'management', 'projects', 'requests', 'owner', 'owner-spaces'].includes(section) && <MyWorkspace key={user.id} selectedSpaceId={selectedSpaceId} createActivity={createActivity} view={section === 'spaces' ? 'spaces' : section === 'management' ? 'management' : section === 'projects' ? 'projects' : section === 'owner-spaces' ? 'owner-spaces' : section === 'owner' ? 'owner' : 'requests'} onOwnerChange={setIsOwner} onActivityAccessChange={setCanCreateActivity} />}
            {section === 'profile' && <div className="account-welcome account-profile-main"><div><h2>Mon profil</h2><p>Modifiez vos coordonnées ci-dessous.</p></div><form className="account-profile-form" onSubmit={saveProfile}><label>Prénom<input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label>Nom<input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} /></label><p>Adresse e-mail : {user.email}</p><button className="button outline" disabled={profileBusy || !firstName.trim() || !lastName.trim()}>{profileBusy ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}</button>{profileError && <p role="alert">{profileError}</p>}{profileNotice && <p role="status">{profileNotice}</p>}</form></div>}
            {section === 'personal' && <div id="mes-inscriptions"><div className="account-welcome"><span className="account-welcome-icon"><Icon name="calendar" /></span><div><h2>Mes participations</h2><p>Retrouvez vos activités, contributions et aides aux projets.</p></div></div><nav className="account-participation-nav" aria-label="Types de participation"><a href="#mes-inscriptions" aria-current={participationTab === 'activities' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}>Activités</a><a href="#participations-projets" aria-current={participationTab === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('participations-projets'); }}>Projets et dons</a><a href="#aides-projets" aria-current={participationTab === 'helps' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('aides-projets'); }}>Aides proposées</a></nav>{participationTab === 'activities' && <><MyBookings key={`bookings-${user.id}`} /><p className="account-demo-note"><Icon name="ticket" /> Certaines activités du catalogue sont des exemples. Leur fiche indique quand le paiement est une simulation.</p></>}{participationTab === 'projects' && <div id="participations-projets"><MyPaidProjectParticipations key={`paid-projects-${user.id}`} /><MyDonations key={`donations-${user.id}`} /></div>}{participationTab === 'helps' && <ProjectParticipations key={`helps-${user.id}`} />}</div>}
          </>}
        </div>
        <aside className="account-sidebar" aria-label="Votre compte">
          <section className="account-profile" id="mon-profil">
            <div className="account-avatar" aria-hidden="true">{user.firstName.slice(0,1)}{user.lastName.slice(0,1)}</div>
            <h2>{user.firstName} {user.lastName}</h2><p>{user.email}</p><span className="account-member">{isOwner ? 'Propriétaire de Belconnect' : 'Compte Belconnect'}</span>
            <div className="account-side-divider" />
            <button className="account-menu-toggle" aria-expanded={menuOpen} aria-controls="account-side-nav" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Fermer le menu' : 'Menu de mon espace'}</button>
            <nav id="account-side-nav" className="account-side-nav" data-open={menuOpen} aria-label="Navigation de mon espace">
              {isOwner === null ? <span role="status">Chargement du menu…</span> : isOwner ? <>
                <span className="account-nav-label">Gérer Belconnect</span>
                <a href="#demandes" aria-current={section === 'requests' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('demandes'); }}>Demandes d’ouverture</a>
                <a href="#espaces" aria-current={section === 'owner-spaces' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}>Espaces organisateurs</a>
                <a href="#suivi-belconnect" aria-current={section === 'owner' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('suivi-belconnect'); }}>Suivi de Belconnect</a>
              </> : <>
                <span className="account-nav-label">Participer</span>
                <a href="#mes-inscriptions" aria-current={section === 'personal' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}><Icon name="ticket" /> Mes participations</a>
                <span className="account-nav-label">Organiser</span>
                {canCreateActivity && <a href={`/mon-espace?${selectedSpaceId ? `espace=${selectedSpaceId}&` : ''}creation=activite#organisation`} aria-current={section === 'management' && createActivity ? 'page' : undefined} onClick={event => { event.preventDefault(); setMenuOpen(false); navigate(`/mon-espace?${selectedSpaceId ? `espace=${selectedSpaceId}&` : ''}creation=activite#organisation`); }}>Créer une activité</a>}
                <a href="#espaces" aria-current={section === 'spaces' || section === 'management' && !createActivity ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /> Espaces et groupes</a>
                <a href="#mes-projets" aria-current={section === 'projects' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-projets'); }}>Mes projets</a>
                <a href="#demandes" aria-current={section === 'requests' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('demandes'); }}>Mes demandes</a>
              </>}
              <span className="account-nav-label">Mon compte</span>
              <a href="#notifications" aria-current={section === 'notifications' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('notifications'); }}>Notifications</a>
              <a href="#mon-profil" aria-current={section === 'profile' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mon-profil'); }}>Profil</a>
            </nav>
            <button className="account-signout" disabled={busy} onClick={logout}>{busy ? "Déconnexion…" : "Se déconnecter"}</button>
            {error && <p role="alert">{error}</p>}
          </section>

        </aside>
      </div>
    </div>
  </section>;
}
