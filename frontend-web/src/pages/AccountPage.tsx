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
  const section = hash === 'espaces' ? 'workspace' : hash === 'aides-projets' ? 'help' : hash === 'mes-inscriptions' ? 'personal' : new URLSearchParams(location.split('?')[1]?.split('#')[0]).has('stripe') ? 'workspace' : 'personal';
  useEffect(() => {
    if (hash === 'espaces' || hash === 'aides-projets' || hash === 'mes-inscriptions') {
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    }
  }, [hash]);
  function openSection(next: "personal" | "workspace" | "help") {
    navigate(`/mon-espace#${next === 'workspace' ? 'espaces' : next === 'help' ? 'aides-projets' : 'mes-inscriptions'}`);
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
      <div className="account-heading"><div><p className="eyebrow teal">VOTRE COIN BELCONNECT</p><h1 tabIndex={-1}>Bonjour {user.firstName || user.lastName} <span className="account-dot">!</span></h1><p>Vos prochaines découvertes commencent ici.</p></div><a className="button coral" href="/activites">Trouver une activité <Icon name="arrow" /></a></div>
      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Votre compte">
          <section className="account-profile" id="mon-profil">
            <div className="account-avatar" aria-hidden="true">{user.firstName.slice(0,1)}{user.lastName.slice(0,1)}</div>
            <h2>{user.firstName} {user.lastName}</h2><p>{user.email}</p><span className="account-member">Compte Belconnect</span>
            <div className="account-side-divider" />
            <a className="account-side-link" href="#mes-inscriptions" onClick={() => openSection("personal")}><Icon name="ticket" /> Mes inscriptions <Icon name="arrow" /></a>
            <details className="account-details"><summary>Mes coordonnées</summary><form className="account-profile-form" onSubmit={saveProfile}><label>Prénom<input required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)} /></label><label>Nom<input required maxLength={80} value={lastName} onChange={event => setLastName(event.target.value)} /></label><p>Adresse e-mail : {user.email}</p><button className="button outline" disabled={profileBusy || !firstName.trim() || !lastName.trim()}>{profileBusy ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}</button></form>{profileError && <p role="alert">{profileError}</p>}{profileNotice && <p role="status">{profileNotice}</p>}<p>Les coordonnées d’une inscription existante se modifient depuis sa fiche.</p></details>
            <button className="account-signout" disabled={busy} onClick={logout}>{busy ? "Déconnexion…" : "Se déconnecter"}</button>
            {error && <p role="alert">{error}</p>}
          </section>
          <div className="account-inspiration"><span className="account-inspiration-icon"><Icon name="leaf" /></span><h2>Et si on sortait<br/>de la routine ?</h2><p>Un atelier, une balade, une rencontre… La prochaine découverte est tout près.</p><a href="/activites">Explorer les activités <Icon name="arrow" /></a></div>
        </aside>
        <div className="account-main"><PaidActivityReturn userId={user.id} /><AccountNotifications key={user.id} onOpenBookings={() => openSection('personal')} /><nav className="account-tabs" aria-label="Rubriques de mon espace"><button aria-pressed={section === "personal"} onClick={() => openSection("personal")}><Icon name="ticket" /> Mes inscriptions</button><button aria-pressed={section === "workspace"} onClick={() => openSection("workspace")}><Icon name="users" /> Mes espaces et projets</button><button aria-pressed={section === "help"} onClick={() => openSection("help")}>Mes aides aux projets</button></nav><div hidden={section !== "help"}><ProjectParticipations key={user.id} /></div><div id="espaces" hidden={section !== "workspace"}><MyWorkspace key={user.id} /></div><div hidden={section !== "personal"}><div className="account-welcome"><span className="account-welcome-icon"><Icon name="calendar" /></span><div><h2>De beaux moments à l’agenda</h2><p>Retrouvez vos inscriptions et préparez vos prochaines sorties, en toute simplicité.</p></div></div><MyBookings key={user.id} /><MyPaidProjectParticipations key={user.id} /><MyDonations key={user.id} /><p className="account-demo-note"><Icon name="ticket" /> Certaines activités du catalogue sont des exemples. Leur fiche indique quand le paiement est une simulation.</p></div></div>
      </div>
    </div>
  </section>;
}
