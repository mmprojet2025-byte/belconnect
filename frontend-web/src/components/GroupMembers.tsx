import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';

type Member = { id: number; name: string; role: string; version: number };
type Roster = { id: number; name: string; spaceName: string; version: number; canManageRoles: boolean; referentsManageMemberships: boolean; canManageMemberships: boolean; referentsManageActivities: boolean; members: Member[] };
type Change = { member: Member; role: string } | { delegation: boolean } | { activities: boolean };
const message = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur.';

export function GroupMembers({ groupId, onChanged, onClose, invitationUrl }: { groupId: number; onChanged: () => void; onClose: () => void; invitationUrl?: string }) {
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showInvitation, setShowInvitation] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  async function invite(event: FormEvent){
    event.preventDefault(); setInviteBusy(true); setError(''); setNotice('');
    try { await postJson(`/api/groups/${groupId}/invite`,{email:inviteEmail.trim()}); setNotice('Invitation envoyée dans BelConnect. La personne peut l’accepter dans Groupes.'); setInviteEmail(''); }
    catch(e){setError(message(e));} finally {setInviteBusy(false);}
  }
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/workspace/groups/${groupId}/members`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => { setData(value); setError(''); }).catch(e => { if (!c.signal.aborted) { setData(null); setError(message(e)); } });
    return () => c.abort();
  }, [groupId, attempt]);
  async function confirm() {
    if (!pending || !data) return;
    setBusy(true); setError('');
    try {
      const value: Roster = 'member' in pending
        ? await postJson(`/api/workspace/groups/${groupId}/members/${pending.member.id}/role`, { version: pending.member.version, role: pending.role })
        : 'activities' in pending ? await postJson(`/api/workspace/groups/${groupId}/activity-permission`, { version: data.version, enabled: pending.activities })
        : await postJson(`/api/workspace/groups/${groupId}/permissions`, { version: data.version, manageMemberships: pending.delegation });
      setData(value); setPending(null); setNotice('Les droits du groupe ont été enregistrés.'); onChanged();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <section className="group-members-panel" aria-label="Membres et référents du groupe">
    <div className="account-section-heading"><div><p className="eyebrow teal">MEMBRES ET RÉFÉRENTS</p><h3>{data?.name ?? 'Membres du groupe'}</h3></div><button className="text-link" disabled={busy} onClick={onClose}>Fermer les membres</button></div>
    {invitationUrl && <div className="group-invite-action"><div className="group-invite-link"><strong>Inviter une personne</strong><p>Saisissez l’adresse e-mail de son compte BelConnect.</p></div><form className="group-invite-form" onSubmit={event => void invite(event)}><label>Adresse e-mail<input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="personne@exemple.com" /></label><button className="button coral" type="submit" disabled={inviteBusy}>{inviteBusy?'Envoi…':'Envoyer l’invitation'}</button></form><button className="text-link" type="button" aria-expanded={showInvitation} onClick={() => setShowInvitation(value => !value)}>Inviter avec un lien</button>{showInvitation && <label className="group-invite-link">Lien d’invitation<input readOnly value={invitationUrl} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} /></label>}</div>}
    <button className="text-link" disabled={busy} onClick={() => { setPending(null); setNotice(''); setAttempt(n => n + 1); onChanged(); }}>Actualiser les membres</button>
    {error && <p className="draft-error" role="alert">{error}</p>}{notice && <p className="account-notice" role="status">{notice}</p>}
    {!data && !error && <p role="status">Chargement des membres…</p>}
    {data && <><p className="workspace-description">{data.spaceName} · {data.members.length} membre{data.members.length > 1 ? 's' : ''} actif{data.members.length > 1 ? 's' : ''}</p>
      <div className="group-permissions"><h4>{data.canManageRoles ? 'Tâches confiées aux référents' : 'Mes tâches de référent'}</h4><p>Le référent accompagne les projets et peut publier des annonces dans ce groupe. L’administrateur décide de la publication finale des projets.</p>
        {data.canManageRoles ? <><p><strong>Adhésions : {data.referentsManageMemberships ? 'confiées aux référents' : 'réservées à l’administrateur'}.</strong></p><button className="button outline" disabled={busy || pending !== null} onClick={() => { setNotice(''); setPending({ delegation: !data.referentsManageMemberships }); }}>{data.referentsManageMemberships ? 'Réserver les adhésions à l’administrateur' : 'Confier les adhésions aux référents'}</button><p><strong>Activités : {data.referentsManageActivities ? 'confiées aux référents' : 'réservées à l’administrateur'}.</strong></p><button className="button outline" disabled={busy || pending !== null} onClick={() => { setNotice(''); setPending({ activities: !data.referentsManageActivities }); }}>{data.referentsManageActivities ? 'Reprendre la gestion des activités' : 'Confier les activités au référent'}</button><p>Ces permissions s’appliquent aux référents de ce groupe uniquement.</p></> : <><p><strong>Adhésions :</strong> {data.canManageMemberships ? 'vous pouvez examiner les demandes reçues.' : 'l’administrateur examine les demandes.'}</p><p><strong>Activités :</strong> {data.referentsManageActivities ? 'vous pouvez créer et suivre les activités de ce groupe dans « Mes activités ».' : 'l’administrateur les gère.'}</p></>}
      </div>
      {pending && <div className="group-role-confirm" role="region" aria-label="Confirmer la modification des droits"><h4>Confirmer la modification</h4><p>{'member' in pending ? pending.role === 'REFERENT' ? `${pending.member.name} deviendra référent de ce groupe, avec les permissions indiquées ci-dessus.` : `${pending.member.name} restera membre de ce groupe, mais perdra son rôle de référent et les droits associés.` : 'activities' in pending ? pending.activities ? 'Les référents de ce groupe pourront préparer ses activités et demander leur publication à l’administrateur, consulter les coordonnées des inscrits et les exporter en CSV. Vous conservez ces droits.' : 'Les référents perdront ces accès. Les activités et inscriptions resteront conservées et accessibles à l’administrateur.' : pending.delegation ? 'Le référent de ce groupe pourra accepter ou refuser les demandes d’adhésion.' : 'Les référents ne pourront plus traiter les adhésions de ce groupe. L’administrateur conservera ce droit.'}</p><div className="management-actions"><button className="button coral" disabled={busy} onClick={confirm}>{busy ? 'Enregistrement…' : 'Confirmer la modification'}</button><button className="button outline" disabled={busy} onClick={() => setPending(null)}>Annuler</button></div></div>}
      <h4 className="group-members-title">Membres actifs du groupe</h4>
      {!data.members.length ? <p className="workspace-description">Aucun membre actif pour le moment. Un utilisateur doit d’abord rejoindre ce groupe avant de pouvoir être désigné référent.</p> : <ul className="group-members-list">{data.members.map(member => <li key={member.id}><div><strong>{member.name}</strong><span className="account-status">{member.role === 'REFERENT' ? 'Référent du groupe' : 'Membre'}</span></div>{data.canManageRoles && <button className="button outline" disabled={busy || pending !== null || (member.role !== 'REFERENT' && data.members.some(person => person.role === 'REFERENT'))} onClick={() => { setNotice(''); setPending({ member, role: member.role === 'REFERENT' ? 'MEMBRE' : 'REFERENT' }); }}>{member.role === 'REFERENT' ? 'Retirer le rôle de référent' : 'Désigner comme référent'}</button>}</li>)}</ul>}
    </>}
  </section>;
}
