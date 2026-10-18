import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Member = { id: number; name: string; role: string; version: number };
type Roster = { id: number; name: string; spaceName: string; version: number; canManageRoles: boolean; referentsManageMemberships: boolean; canManageMemberships: boolean; members: Member[] };
type Change = { member: Member; role: string } | { delegation: boolean };
const message = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur.';

export function GroupMembers({ groupId, onChanged, onClose }: { groupId: number; onChanged: () => void; onClose: () => void }) {
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
        : await postJson(`/api/workspace/groups/${groupId}/permissions`, { version: data.version, manageMemberships: pending.delegation });
      setData(value); setPending(null); setNotice('Les droits du groupe ont été enregistrés.'); onChanged();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <section className="group-members-panel" aria-label="Membres et référents du groupe">
    <div className="account-section-heading"><div><p className="eyebrow teal">MEMBRES ET RÉFÉRENTS</p><h3>{data?.name ?? 'Membres du groupe'}</h3></div><button className="text-link" disabled={busy} onClick={onClose}>Fermer les membres</button></div>
    <button className="text-link" disabled={busy} onClick={() => { setPending(null); setNotice(''); setAttempt(n => n + 1); onChanged(); }}>Actualiser les membres</button>
    {error && <p className="draft-error" role="alert">{error}</p>}{notice && <p className="account-notice" role="status">{notice}</p>}
    {!data && !error && <p role="status">Chargement des membres…</p>}
    {data && <><p className="workspace-description">{data.spaceName} · {data.members.length} membre{data.members.length > 1 ? 's' : ''} actif{data.members.length > 1 ? 's' : ''}</p>
      <div className="group-permissions"><h4>Permissions des référents</h4><p>Les référents consultent les membres et accompagnent les projets de ce groupe. La validation finale des projets reste réservée à l’administrateur.</p><p><strong>Traitement des adhésions : {data.referentsManageMemberships ? 'autorisé aux référents' : 'réservé à l’administrateur'}.</strong></p>
        {data.canManageRoles ? <><p>Ce réglage s’applique à tous les référents de ce groupe. Vous conservez toujours la possibilité de traiter les demandes.</p><button className="button outline" disabled={busy || pending !== null} onClick={() => { setNotice(''); setPending({ delegation: !data.referentsManageMemberships }); }}>{data.referentsManageMemberships ? 'Réserver les adhésions à l’administrateur' : 'Autoriser les référents à gérer les adhésions'}</button></> : <p>{data.canManageMemberships ? 'Vous pouvez accepter ou refuser les demandes dans « Demandes d’adhésion reçues ».' : 'Vous accompagnez les projets ; l’administrateur traite les adhésions.'} Seul l’administrateur peut modifier les rôles et cette permission.</p>}
      </div>
      {pending && <div className="group-role-confirm" role="region" aria-label="Confirmer la modification des droits"><h4>Confirmer la modification</h4><p>{'member' in pending ? pending.role === 'REFERENT' ? `${pending.member.name} deviendra référent de ce groupe, avec les permissions indiquées ci-dessus.` : `${pending.member.name} restera membre de ce groupe, mais perdra son rôle de référent et les droits associés.` : pending.delegation ? 'Tous les référents actifs de ce groupe pourront accepter ou refuser les demandes d’adhésion.' : 'Les référents ne pourront plus traiter les adhésions de ce groupe. L’administrateur conservera ce droit.'}</p><div className="management-actions"><button className="button coral" disabled={busy} onClick={confirm}>{busy ? 'Enregistrement…' : 'Confirmer la modification'}</button><button className="button outline" disabled={busy} onClick={() => setPending(null)}>Annuler</button></div></div>}
      <h4 className="group-members-title">Membres actifs du groupe</h4>
      {!data.members.length ? <p className="workspace-description">Aucun membre actif pour le moment. Un utilisateur doit d’abord rejoindre ce groupe avant de pouvoir être désigné référent.</p> : <ul className="group-members-list">{data.members.map(member => <li key={member.id}><div><strong>{member.name}</strong><span className="account-status">{member.role === 'REFERENT' ? 'Référent' : 'Membre'}</span></div>{data.canManageRoles && <button className="button outline" disabled={busy || pending !== null} onClick={() => { setNotice(''); setPending({ member, role: member.role === 'REFERENT' ? 'MEMBRE' : 'REFERENT' }); }}>{member.role === 'REFERENT' ? 'Retirer le rôle de référent' : 'Désigner comme référent'}</button>}</li>)}</ul>}
    </>}
  </section>;
}
