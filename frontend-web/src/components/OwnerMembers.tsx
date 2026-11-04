import { useEffect, useState } from 'react';
import { MemberInterventions } from './MemberInterventions';
import './OwnerMembers.css';
import { postJson, result } from '../lib/auth';

type Assignment = { scope: 'ESPACE' | 'GROUPE'; name: string; role: string; status: string; scopeId?:number; spaceId?:number };
type Member = { id: number; name: string; email: string; status: string; owner: boolean; roles: Assignment[] };
type MemberPage = { items: Member[]; total: number; page: number; pageSize: number };
const label: Record<string, string> = { PROPRIETAIRE: 'Propriétaire', ADMINISTRATEUR: 'Administrateur', REFERENT: 'Référent', MEMBRE: 'Membre', ACTIF: 'Actif', SUSPENDU: 'Suspendu', RETIRE: 'Retiré', DESACTIVE: 'Désactivé' };

export function OwnerMembers({ spaceId }: { spaceId?: number }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [localGroup,setLocalGroup]=useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [roleFilter,setRoleFilter]=useState(''),[statusFilter,setStatusFilter]=useState(''),[spaceFilter,setSpaceFilter]=useState(''),[groupFilter,setGroupFilter]=useState('');
  const [scopes,setScopes]=useState<{spaces:{id:number;name:string}[];groups:{id:number;space_id:number;name:string}[]}>({spaces:[],groups:[]});
  const [action,setAction]=useState<{member:Member;assignment:Assignment}|null>(null),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{if(spaceId)return;const c=new AbortController();fetch('/api/workspace/member-interventions/scopes',{credentials:'same-origin',signal:c.signal}).then(result).then(setScopes).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[spaceId]);
  async function intervene(){if(!action)return;const a=action.assignment;const admin=a.scope==='ESPACE'&&a.role==='ADMINISTRATEUR';if(!window.confirm(admin?'Modifier l’accès de cet administrateur dans cet espace uniquement ?':'Envoyer une demande de suspension à l’administrateur ? Aucun accès ne change avant son accord.'))return;setSaving(true);setError('');try{if(admin)await postJson(`/api/workspace/spaces/${a.spaceId}/administrators/${action.member.id}/status`,{status:a.status==='ACTIF'?'SUSPENDU':'ACTIF',reason});else await postJson('/api/workspace/member-interventions',{spaceId:a.spaceId,groupId:a.scope==='GROUPE'?a.scopeId:null,memberId:action.member.id,reason});setNotice(admin?'Accès mis à jour dans cet espace.':'Demande envoyée. L’administrateur la retrouve dans Réglages → Membres de son espace.');setAction(null);setReason('');setRefresh(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'Action impossible.');}finally{setSaving(false);}}

  useEffect(() => {
    const controller = new AbortController();
    const path = spaceId ? `/api/workspace/spaces/${spaceId}/members` : `/api/workspace/owner/members/paged?page=${page}&search=${encodeURIComponent(query)}&role=${roleFilter}&status=${statusFilter}${spaceFilter?`&spaceId=${spaceFilter}`:''}${groupFilter?`&groupId=${groupFilter}`:''}`;
    fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((value: Member[] | MemberPage) => { if (!controller.signal.aborted) { setMembers(Array.isArray(value) ? value : value.items); setTotal(Array.isArray(value) ? value.length : value.total); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les membres sont indisponibles.'); });
    return () => controller.abort();
  }, [refresh, spaceId, page, query,roleFilter,statusFilter,spaceFilter,groupFilter]);
  const localGroups=spaceId?[...new Set((members??[]).flatMap(member=>member.roles.filter(role=>role.scope==='GROUPE').map(role=>role.name)))].sort((a,b)=>a.localeCompare(b,'fr')):[];
  const visible = spaceId ? members?.filter(member => (!localGroup||member.roles.some(role=>role.scope==='GROUPE'&&role.name===localGroup))&&`${member.name} ${member.email} ${member.roles.map(role => role.name).join(' ')}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))) : members;
  return <div className="workspace-panel owner-members">
    <div className="account-section-heading"><h2>{spaceId ? 'Membres de l’espace' : 'Membres et rôles'}</h2><button className="text-link" onClick={() => setRefresh(value => value + 1)}>Actualiser</button></div>
    <p className="workspace-description">{spaceId ? 'Seuls les membres de cet espace et leurs rôles dans ses groupes apparaissent ici.' : 'Un compte peut être membre de plusieurs espaces ou groupes. Les rôles affichés sont limités à leur périmètre ; « participant » signifie qu’aucun rôle de gestion n’a été attribué.'}</p>
    {!spaceId&&<div className="member-filters"><label>Rôle<select value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(0);}}><option value="">Tous les rôles</option>{['ADMINISTRATEUR','REFERENT','MEMBRE','PROPRIETAIRE'].map(r=><option key={r} value={r}>{label[r]}</option>)}</select></label><label>Espace<select value={spaceFilter} onChange={e=>{setSpaceFilter(e.target.value);setGroupFilter('');setPage(0);}}><option value="">Tous les espaces</option>{scopes.spaces.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Groupe<select value={groupFilter} onChange={e=>{setGroupFilter(e.target.value);setPage(0);}}><option value="">Tous les groupes</option>{scopes.groups.filter(x=>!spaceFilter||x.space_id===Number(spaceFilter)).map(x=><option key={x.id} value={x.id}>{x.name} · {scopes.spaces.find(a=>a.id===x.space_id)?.name}</option>)}</select></label><label>État du compte<select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(0);}}><option value="">Tous les états</option>{['ACTIF','SUSPENDU','DESACTIVE'].map(x=><option key={x} value={x}>{label[x]}</option>)}</select></label><button className="button outline" onClick={()=>{setRoleFilter('');setStatusFilter('');setSpaceFilter('');setGroupFilter('');setSearch('');setQuery('');setPage(0);}}>Réinitialiser</button></div>}
    {spaceId&&<div className="member-filters"><label>Afficher les membres<select value={localGroup} onChange={e=>setLocalGroup(e.target.value)}><option value="">Tout l’espace</option>{localGroups.map(name=><option key={name} value={name}>Groupe · {name}</option>)}</select></label><p>Cette liste concerne uniquement cet espace. Choisissez un groupe pour voir ses membres, avec leur rôle dans l’espace et dans le groupe.</p></div>}
    {notice&&<p role="status" className="account-notice">{notice}</p>}
    {action&&<section className="member-action-panel"><h3>{action.assignment.role==='ADMINISTRATEUR'?'Intervenir sur l’administration':'Demander un accord'}</h3><p><strong>{action.member.name}</strong> · {action.assignment.name}</p><p>Cette action concerne uniquement cette appartenance. Le compte et les autres espaces restent inchangés. Un impayé ne constitue pas une preuve de fraude.</p><label>Faits et motif (10 caractères minimum)<textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000}/></label><div className="management-actions"><button className="button outline" disabled={saving} onClick={()=>setAction(null)}>Fermer</button><button className="button outline" disabled={saving||reason.trim().length<10} onClick={()=>void intervene()}>{saving?'En cours…':action.assignment.role==='ADMINISTRATEUR'?(action.assignment.status==='ACTIF'?'Suspendre dans cet espace':'Réactiver dans cet espace'):'Envoyer la demande'}</button></div></section>}
    {error && <p role="alert">{error}</p>}
    {!members && !error && <p role="status">Chargement des membres…</p>}
    {members && <p>{spaceId ? visible?.length ?? 0 : total} compte{(spaceId?visible?.length:total) === 1 ? '' : 's'} trouvé{(spaceId?visible?.length:total) === 1 ? '' : 's'}</p>}
    <form onSubmit={event => { event.preventDefault(); setPage(0); setMembers(null); setQuery(search); }}><label>Rechercher un membre<input type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Nom, e-mail ou espace" /></label>{!spaceId && <button className="button outline" type="submit">Rechercher</button>}</form>
    <div className="member-list">{visible?.map(member => <details className="member-row" key={member.id}><summary><strong>{member.name || member.email}</strong><span>{member.email}</span><span className="member-chip">{label[member.status]??member.status}</span></summary><div className="member-row-body">

      {member.owner ? <p><strong>Propriétaire de Belconnect</strong></p> : member.roles.length === 0 ? <p>Participant, sans rôle dans un espace</p> : null}
      {member.roles.map((role, index) => <p key={`${role.scope}-${role.name}-${index}`}><strong>{role.scope === 'ESPACE' ? 'Espace' : 'Groupe'} {role.name}</strong> : {label[role.role] ?? role.role}{role.status !== 'ACTIF' ? ` · ${label[role.status] ?? role.status}` : ''}{!spaceId&&!member.owner&&role.spaceId&&!(role.scope==='GROUPE'&&member.roles.some(r=>r.scope==='ESPACE'&&r.spaceId===role.spaceId&&r.role==='ADMINISTRATEUR'))&&(role.status==='ACTIF'||role.role==='ADMINISTRATEUR'&&role.status==='SUSPENDU')&&<button className="button outline" onClick={()=>{setAction({member,assignment:role});setReason('');setNotice('');}}>{role.scope==='ESPACE'&&role.role==='ADMINISTRATEUR'?(role.status==='ACTIF'?'Suspendre dans cet espace':'Réactiver dans cet espace'):'Demander une suspension'}</button>}</p>)}
    </div></details>)}</div>
    <MemberInterventions spaceId={spaceId} revision={refresh} onChanged={()=>setRefresh(n=>n+1)} />
    {!spaceId && total > 20 && <div className="management-actions"><button className="button outline" disabled={page === 0} onClick={() => { setMembers(null); setPage(value => value - 1); }}>Précédent</button><span>Page {page + 1} sur {Math.ceil(total / 20)}</span><button className="button outline" disabled={(page + 1) * 20 >= total} onClick={() => { setMembers(null); setPage(value => value + 1); }}>Suivant</button></div>}
  </div>;
}
