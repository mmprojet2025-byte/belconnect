import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
type Action = { key: string; action: string; target: string; reason: string; at: string };
const labels: Record<string,string> = { SUSPENDRE_ESPACE: 'Espace suspendu', REACTIVER_ESPACE: 'Espace réactivé', MASQUER: 'Contenu masqué', RETABLIR: 'Contenu rétabli', ADMINISTRATEUR_SUSPENDU: 'Administrateur suspendu', ADMINISTRATEUR_REACTIVE: 'Administrateur réactivé', ADMINISTRATEUR_RECUPERE: 'Administrateur de remplacement désigné', DEMANDE_APPROUVEE: 'Demande d’espace approuvée', DEMANDE_REFUSEE: 'Demande d’espace refusée', DEMANDE_CORRECTION: 'Demande corrigée', DEMANDE_REEXAMEN: 'Demande remise à l’examen', SIGNALEMENT_EXAMINE: 'Signalement marqué comme examiné' };
export function OwnerActionLog() {
 const [page,setPage]=useState(0),[refresh,setRefresh]=useState(0);
 const [items,setItems]=useState<Action[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');
 fetch(`/api/auth/owner-mfa/actions?page=${page}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(result).then(value=>{setItems(value.items);setMore(value.hasMore);}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[page,refresh]);
 return <div aria-busy={busy}><p>Actions réalisées par votre compte, reprises des historiques de gestion. Les tentatives refusées par les permissions ne sont pas encore incluses. Les noms affichés sont les noms actuels des éléments.</p>
 <button className="button outline" disabled={busy} onClick={()=>{setPage(0);setRefresh(x=>x+1);}}>Actualiser les actions</button>
 {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Chargement…</p>}
 {!busy&&!error&&!items.length&&<p>Aucune action enregistrée.</p>}
 {!busy&&!error&&<ol>{items.map(item=><li key={item.key}><div><strong>{labels[item.action]??item.action.replaceAll('_',' ')}</strong><span>{item.target}</span><time dateTime={item.at}>{new Date(item.at).toLocaleString('fr-BE')}</time><small>Acteur : votre compte · Action effectuée</small>{item.reason&&<details><summary>Voir le motif</summary><p>{item.reason}</p></details>}</div></li>)}</ol>}
 <div className="management-actions"><button className="button outline" disabled={busy||page===0} onClick={()=>setPage(x=>x-1)}>Précédent</button><span>Page {page+1}</span><button className="button outline" disabled={busy||!more} onClick={()=>setPage(x=>x+1)}>Suivant</button></div></div>;
}
