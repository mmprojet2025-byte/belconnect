import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import './Groups.css';

type Group = { id: number; name: string; description: string; coverUrl: string; spaceName: string; openMembership: boolean; visibility: string; membershipStatus: string };
type Invitation = { id: number; name: string; description: string; spaceName: string; openMembership: boolean; membershipStatus: string };
const states: Record<string, string> = { MEMBRE: 'Vous êtes membre', ADMINISTRATEUR: 'Vous administrez ce groupe', EN_ATTENTE: 'Demande en attente', REFUSEE: 'Demande refusée', INDISPONIBLE: 'Accès suspendu ou retiré', ACCEPTEE: 'Adhésion acceptée' };
const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur.';

function JoinGroup({ group, signedIn, onJoined, invitationCode }: { group: Group; signedIn: boolean; onJoined: () => void; invitationCode?: string }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function join() {
    setBusy(true); setError('');
    try { await postJson(invitationCode ? `/api/groups/invitations/${invitationCode}/join` : `/api/groups/${group.id}/join`); setConfirm(false); onJoined(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (!signedIn) return <a className="button outline" href={`/connexion?retour=${encodeURIComponent(`/groupes${invitationCode ? `?invitation=${invitationCode}` : ''}`)}`}>Se connecter pour rejoindre</a>;
  if (group.membershipStatus !== 'AUCUNE') return <div><p className="group-status" role="status">{states[group.membershipStatus]}</p><a className="text-link" href="/mon-espace#espaces">Voir mon espace →</a></div>;
  return <div className="group-join">{confirm ? <><p>{group.openMembership ? 'Vous deviendrez membre de ce groupe et de son espace organisateur.' : 'Votre demande sera examinée par l’administrateur. Après acceptation, vous deviendrez membre du groupe et de son espace.'}</p><div className="group-actions"><button className="button coral" disabled={busy} onClick={join}>{busy ? 'Envoi…' : group.openMembership ? 'Confirmer mon adhésion' : 'Envoyer ma demande'}</button><button className="button outline" disabled={busy} onClick={() => { setConfirm(false); setError(''); }}>Annuler</button></div></> : <button className="button coral" onClick={() => setConfirm(true)}>{group.openMembership ? 'Rejoindre le groupe' : 'Demander à rejoindre'}</button>}{error && <p className="group-error" role="alert">{error}</p>}</div>;
}

export function Groups({ signedIn }: { signedIn: boolean }) {
  const invitationCode = new URLSearchParams(window.location.search).get('invitation');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invitationError, setInvitationError] = useState('');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/groups', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => { setGroups(value); setError(''); }).catch(e => { if (!c.signal.aborted) setError(errorMessage(e)); });
    return () => c.abort();
  }, [attempt, signedIn]);
  useEffect(() => {
    if (!invitationCode) return;
    const c = new AbortController();
    fetch(`/api/groups/invitations/${encodeURIComponent(invitationCode)}`, { credentials: 'same-origin', cache: 'no-store', signal: c.signal })
      .then(result).then(setInvitation).catch(e => { if (!c.signal.aborted) setInvitationError(errorMessage(e)); });
    return () => c.abort();
  }, [attempt, invitationCode, signedIn]);
  const filtered = (groups ?? []).filter(g => `${g.name} ${g.spaceName} ${g.description}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')) && (filter === 'ALL' || g.openMembership === (filter === 'OPEN')));
  return <section className="container groups-page"><a className="text-link" href="/">← Accueil</a><p className="eyebrow teal">DES LIENS QUI GRANDISSENT</p><h1 tabIndex={-1}>Trouvez votre communauté</h1><p className="groups-intro">Un jardin partagé, un atelier, un projet de quartier… Retrouvez des personnes qui partagent vos envies.</p>
    {invitationCode && <section className="group-card" aria-label="Invitation à un groupe privé"><div className="group-card-content"><h2>Votre invitation</h2>{invitationError && <p role="alert">{invitationError}</p>}{!invitation && !invitationError && <p role="status">Chargement de l’invitation…</p>}{invitation && <><h3>{invitation.name}</h3><p>{invitation.spaceName}</p><p>{invitation.description}</p><JoinGroup group={{ ...invitation, coverUrl: '', visibility: 'PRIVEE' }} signedIn={signedIn} invitationCode={invitationCode} onJoined={() => { setNotice(invitation.openMembership ? 'Votre adhésion est enregistrée.' : 'Votre demande est enregistrée. Suivez sa réponse dans Mon espace.'); setAttempt(n => n + 1); }} /></>}</div></section>}
    <div className="groups-tools"><label>Rechercher un groupe<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Un groupe, un espace, une envie…" /></label><label>Adhésion<select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Tous les groupes</option><option value="OPEN">Adhésion ouverte</option><option value="REQUEST">Sur demande</option></select></label><button className="button outline" onClick={() => setAttempt(n => n + 1)}>Actualiser</button></div>
    {signedIn && <p><a className="text-link" href="/mon-espace#espaces">Suivre mes adhésions dans Mon espace →</a></p>}
    {notice && <p className="group-notice" role="status">{notice}</p>}
    {error && <p className="group-error" role="alert">{error} Utilisez « Actualiser » pour réessayer.</p>}
    {groups === null && !error ? <p role="status">Chargement des groupes…</p> : groups !== null && !filtered.length ? <div className="groups-empty"><h2>{query || filter !== 'ALL' ? 'Aucun groupe ne correspond' : 'Les communautés prennent forme'}</h2><p>{query || filter !== 'ALL' ? 'Essayez un autre nom ou un autre mode d’adhésion.' : 'Aucun groupe accessible pour le moment. Revenez bientôt découvrir les nouveaux groupes.'}</p></div> : <div className="groups-grid">{filtered.map(group => <article className="group-card" key={group.id}>
      {group.coverUrl ? <img key={group.coverUrl} src={group.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/visuel-indisponible.svg'; }} /> : <div className="group-art" aria-hidden="true">{group.name.slice(0, 1).toUpperCase()}</div>}
      <div className="group-card-content"><span className="group-tag">{group.openMembership ? 'Adhésion ouverte' : 'Sur demande'}{group.visibility === 'PRIVEE' ? ' · Réservé à l’espace' : ''}</span><h2>{group.name}</h2><p className="group-space">{group.spaceName}</p><p className="group-description">{group.description || 'Un groupe pour se rencontrer et partager.'}</p><JoinGroup group={group} signedIn={signedIn} onJoined={() => { setNotice(group.openMembership ? 'Votre adhésion est enregistrée. Retrouvez le groupe dans Mon espace.' : 'Votre demande est enregistrée. Retrouvez la réponse dans Mon espace après actualisation.'); setAttempt(n => n + 1); }} /></div>
    </article>)}</div>}
  </section>;
}
