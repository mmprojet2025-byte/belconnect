import { ProjectParticipations } from '../components/ProjectParticipations';
import { useEffect, useState } from "react";
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
import "./Enrollment.css";
import "./AccountPage.css";

export function AccountPage({ user, onLogout, onProfileSaved }: { user: UserProfile; onLogout: () => Promise<void>; onProfileSaved: (profile: UserProfile) => void }) {
  const location = useLocation();
  const hash = location.split('#')[1];
  const workspaceHashes = ['espaces', 'mes-projets', 'demandes', 'suivi-belconnect'];
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const section = isOwner ? hash === 'mon-profil' ? 'profile' : 'workspace' : workspaceHashes.includes(hash) ? 'workspace' : hash === 'aides-projets' ? 'help' : hash === 'mon-profil' ? 'profile' : new URLSearchParams(location.split('?')[1]?.split('#')[0]).has('stripe') ? 'workspace' : 'personal';
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace/owner/access', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : false)
      .then(value => { if (!controller.signal.aborted) setIsOwner(value === true); })
      .catch(() => { if (!controller.signal.aborted) setIsOwner(false); });
    return () => controller.abort();
  }, [user.id]);
  useEffect(() => {
    requestAnimationFrame(() => document.querySelector('.account-heading')?.scrollIntoView?.());
  }, [hash]);
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
    setBusy(true); setError("");
    try { await onLogout(); }
    catch { setError("La déconnexion a échoué. Réessayez."); }
    finally { setBusy(false); }
  }
  return <section className="account-page">
    <div className="container">
      <div className="account-breadcrumb"><a href="/">Accueil</a><span aria-hidden="true">/</span><span>Mon espace</span></div>
      <div className="account-heading"><div><p className="eyebrow teal">{isOwner ? 'PILOTAGE BELCONNECT' : 'VOTRE COIN BELCONNECT'}</p><h1 tabIndex={-1}>Bonjour {user.firstName || user.lastName} <span className="account-dot">!</span></h1><p>{isOwner ? 'Suivez la plateforme et examinez les demandes d’ouverture d’espace.' : 'Vos prochaines découvertes commencent ici.'}</p></div>{isOwner === false && <a className="button coral" href="/activites">Trouver une activité <Icon name="arrow" /></a>}</div>
      <div className="account-layout">
        <div className="account-main">{isOwner === null ? <p role="status">Chargement de vos accès…</p> : <>{!isOwner && <PaidActivityReturn userId={user.id} />}<AccountNotifications key={user.id} owner={isOwner} onOpenBookings={() => openSection('mes-inscriptions')} onOpenRequests={() => openSection('demandes')} />{section === "help" && <div id="aides-projets"><ProjectParticipations key={user.id} /></div>}{section === "workspace" && <div id="espaces"><MyWorkspace key={user.id} view={isOwner ? hash === 'demandes' ? 'requests' : 'owner' : hash === 'mes-projets' ? 'projects' : hash === 'demandes' ? 'requests' : 'spaces'} onOwnerChange={setIsOwner} /></div>}{section === "profile" && <div className="account-welcome"><div><h2>Mon profil</h2><p>Modifiez vos coordonnées dans la carte de compte à gauche.</p></div></div>}{section === "personal" && <div id="mes-inscriptions"><div className="account-welcome"><span className="account-welcome-icon"><Icon name="calendar" /></span><div><h2>Mes participations</h2><p>Retrouvez vos réservations, vos actions payantes et vos dons.</p></div></div><MyBookings key={`bookings-${user.id}`} /><MyPaidProjectParticipations key={`paid-projects-${user.id}`} /><MyDonations key={`donations-${user.id}`} /><p className="account-demo-note"><Icon name="ticket" /> Certaines activités du catalogue sont des exemples. Leur fiche indique quand le paiement est une simulation.</p></div>}</>}</div>
        <aside className="account-sidebar" aria-label="Votre compte">
          <section className="account-profile" id="mon-profil">
            <div className="account-avatar" aria-hidden="true">{user.firstName.slice(0,1)}{user.lastName.slice(0,1)}</div>
            <h2>{user.firstName} {user.lastName}</h2><p>{user.email}</p><span className="account-member">{isOwner ? 'Propriétaire de Belconnect' : 'Compte Belconnect'}</span>
            <div className="account-side-divider" />
            <button className="account-menu-toggle" aria-expanded={menuOpen} aria-controls="account-side-nav" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Fermer le menu' : 'Menu de mon espace'}</button>
            <nav id="account-side-nav" className="account-side-nav" data-open={menuOpen} aria-label="Navigation de mon espace">
              {isOwner === null ? <span role="status">Chargement du menu…</span> : isOwner ? <><a href="#suivi-belconnect" aria-current={section === 'workspace' && hash !== 'demandes' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('suivi-belconnect'); }}>Suivi de Belconnect</a><a href="#demandes" aria-current={hash === 'demandes' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('demandes'); }}>Demandes d’ouverture</a></> : <>
                <a href="#mes-inscriptions" aria-current={section === 'personal' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-inscriptions'); }}><Icon name="ticket" /> Mes participations</a>
                <a href="#espaces" aria-current={hash === 'espaces' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('espaces'); }}><Icon name="users" /> Mes espaces et groupes</a>
                <a href="#mes-projets" aria-current={hash === 'mes-projets' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mes-projets'); }}>Mes projets</a>
                <a href="#demandes" aria-current={hash === 'demandes' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('demandes'); }}>Mes demandes</a>
                <a href="#aides-projets" aria-current={section === 'help' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('aides-projets'); }}>Mes aides</a></>}
              <a href="#mon-profil" aria-current={section === 'profile' ? 'page' : undefined} onClick={event => { event.preventDefault(); openSection('mon-profil'); }}>Mon profil</a>
            </nav>
            <details className="account-details"><summary>Mes coordonnées</summary><form className="account-profile-form" onSubmit={saveProfile}><label>Prénom<input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label>Nom<input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} /></label><p>Adresse e-mail : {user.email}</p><button className="button outline" disabled={profileBusy || !firstName.trim() || !lastName.trim()}>{profileBusy ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}</button></form>{profileError && <p role="alert">{profileError}</p>}{profileNotice && <p role="status">{profileNotice}</p>}{!isOwner && <p>Les coordonnées d’une inscription existante se modifient depuis sa fiche.</p>}</details>
            <button className="account-signout" disabled={busy} onClick={logout}>{busy ? "Déconnexion…" : "Se déconnecter"}</button>
            {error && <p role="alert">{error}</p>}
          </section>
          {isOwner === false && <div className="account-inspiration"><span className="account-inspiration-icon"><Icon name="leaf" /></span><h2>Et si on sortait<br/>de la routine ?</h2><p>Un atelier, une balade, une rencontre… La prochaine découverte est tout près.</p><a href="/activites">Explorer les activités <Icon name="arrow" /></a></div>}
        </aside>
      </div>
    </div>
  </section>;
}
