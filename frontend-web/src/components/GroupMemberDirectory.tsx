import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Member = { id: number; name: string; avatarCode: string | null };

export function GroupMemberDirectory({ groupId, groupName, onBack }: { groupId: number; groupName: string; onBack: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/mobile/messages/groups/${groupId}/members`, {
      credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(result).then((items: Member[]) => { setMembers(items); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Impossible de charger les membres.'); });
    return () => controller.abort();
  }, [groupId, attempt]);

  return <section className="group-members-panel" aria-label={`Membres de ${groupName}`}>
    <div className="account-section-heading"><div><p className="eyebrow teal">GROUPE</p><h3>{groupName}</h3></div><button className="text-link" onClick={onBack}>← Mes groupes</button></div>
    <p className="workspace-description">Personnes que vous pouvez retrouver dans ce groupe. La messagerie est disponible dans l’application mobile.</p>
    {error && <p className="draft-error" role="alert">{error} <button className="text-link" onClick={() => setAttempt(value => value + 1)}>Réessayer</button></p>}
    {!members && !error && <p role="status">Chargement des membres…</p>}
    {members && <><h4 className="group-members-title">Autres membres du groupe ({members.length})</h4>{members.length ? <ul className="group-members-list">{members.map(member => <li key={member.id}><div><strong>{member.name}</strong></div></li>)}</ul> : <p className="workspace-description">Aucun autre membre actif pour le moment.</p>}</>}
  </section>;
}
