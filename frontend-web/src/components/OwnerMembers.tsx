import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Assignment = { scope: 'ESPACE' | 'GROUPE'; name: string; role: string; status: string };
type Member = { id: number; name: string; email: string; status: string; owner: boolean; roles: Assignment[] };
type MemberPage = { items: Member[]; total: number; page: number; pageSize: number };
const label: Record<string, string> = { PROPRIETAIRE: 'Propriétaire', ADMINISTRATEUR: 'Administrateur', REFERENT: 'Référent', MEMBRE: 'Membre', ACTIF: 'Actif', SUSPENDU: 'Suspendu', RETIRE: 'Retiré', DESACTIVE: 'Désactivé' };

export function OwnerMembers({ spaceId }: { spaceId?: number }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const path = spaceId ? `/api/workspace/spaces/${spaceId}/members` : `/api/workspace/owner/members/paged?page=${page}&search=${encodeURIComponent(query)}`;
    fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((value: Member[] | MemberPage) => { if (!controller.signal.aborted) { setMembers(Array.isArray(value) ? value : value.items); setTotal(Array.isArray(value) ? value.length : value.total); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les membres sont indisponibles.'); });
    return () => controller.abort();
  }, [refresh, spaceId, page, query]);
  const visible = spaceId ? members?.filter(member => `${member.name} ${member.email} ${member.roles.map(role => role.name).join(' ')}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))) : members;
  return <div className="workspace-panel owner-members">
    <div className="account-section-heading"><h2>{spaceId ? 'Membres de l’espace' : 'Membres et rôles'}</h2><button className="text-link" onClick={() => setRefresh(value => value + 1)}>Actualiser</button></div>
    <p className="workspace-description">{spaceId ? 'Seuls les membres de cet espace et leurs rôles dans ses groupes apparaissent ici.' : 'Un compte peut être membre de plusieurs espaces ou groupes. Les rôles affichés sont limités à leur périmètre ; « participant » signifie qu’aucun rôle de gestion n’a été attribué.'}</p>
    <form onSubmit={event => { event.preventDefault(); setPage(0); setMembers(null); setQuery(search); }}><label>Rechercher un membre<input type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Nom, e-mail ou espace" /></label>{!spaceId && <button className="button outline" type="submit">Rechercher</button>}</form>
    {error && <p role="alert">{error}</p>}
    {!members && !error && <p role="status">Chargement des membres…</p>}
    {members && <p>{spaceId ? visible?.length ?? 0 : total} compte{total === 1 ? '' : 's'} trouvé{total === 1 ? '' : 's'}</p>}
    <div className="workspace-grid">{visible?.map(member => <article className="workspace-card" key={member.id}>
      <h3>{member.name || member.email}</h3><p>{member.email} · {label[member.status] ?? member.status}</p>
      {member.owner ? <p><strong>Propriétaire de Belconnect</strong></p> : member.roles.length === 0 ? <p>Participant, sans rôle dans un espace</p> : null}
      {member.roles.map((role, index) => <p key={`${role.scope}-${role.name}-${index}`}><strong>{role.scope === 'ESPACE' ? 'Espace' : 'Groupe'} {role.name}</strong> : {label[role.role] ?? role.role}{role.status !== 'ACTIF' ? ` · ${label[role.status] ?? role.status}` : ''}</p>)}
    </article>)}</div>
    {!spaceId && total > 20 && <div className="management-actions"><button className="button outline" disabled={page === 0} onClick={() => { setMembers(null); setPage(value => value - 1); }}>Précédent</button><span>Page {page + 1} sur {Math.ceil(total / 20)}</span><button className="button outline" disabled={(page + 1) * 20 >= total} onClick={() => { setMembers(null); setPage(value => value + 1); }}>Suivant</button></div>}
  </div>;
}
