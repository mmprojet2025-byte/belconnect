import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import './OwnerDashboard.css';
type Summary={openingRequests:number;reports:number;proRequests:number;unmanagedSpaces:number;suspendedSpaces:number;pendingRefunds:number;activeSpaces:number;activeMembers:number};
export function OwnerDashboard(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0),[updated,setUpdated]=useState<Date|null>(null);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');fetch('/api/workspace/owner/dashboard',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(result).then(value=>{setData(value);setUpdated(new Date());}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[revision]);
 const priority=data?[
  {count:data.reports,title:'Signalements à examiner',description:'Lire les signalements et décider de la suite.',link:'/mon-espace?alerte=signalements#espaces',action:'Examiner'},
  {count:data.unmanagedSpaces,title:'Espaces sans administrateur actif',description:'Vérifier qui peut reprendre la gestion.',link:'/mon-espace?alerte=sans-admin#espaces',action:'Vérifier les espaces'},
 ].filter(item=>item.count>0):[];
 const tasks=data?[
  {count:data.openingRequests,title:'Demandes d’espace',description:'Décider de l’ouverture des nouveaux espaces.',link:'/mon-espace#a-traiter',action:'Examiner les demandes'},
  {count:data.proRequests,title:'Demandes de passage en Pro',description:'Prendre en charge les demandes reçues.',link:'/mon-espace#abonnements-factures',action:'Ouvrir les demandes Pro'},
 ].filter(item=>item.count>0):[];
 const row=(item:{count:number;title:string;description:string;link:string;action:string})=><li key={item.title}><span className="owner-priority-count">{item.count}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><a className="button outline" href={item.link}>{item.action} →</a></li>;
 return <div className="owner-dashboard" aria-busy={busy}>
  <header className="workspace-context-header"><div className="account-section-heading"><div><span className="workspace-context-kicker">Pilotage de BelConnect</span><h2>Tableau de bord</h2><p>Ce qui demande votre attention, puis les actions à réaliser.</p></div><button className="button outline" disabled={busy} onClick={()=>setRevision(x=>x+1)}>Actualiser</button></div></header>
  {error&&<p role="alert">Les indicateurs sont indisponibles. Réessayez ou ouvrez les rubriques du menu. {data?'Les derniers chiffres affichés peuvent être dépassés.':''}</p>}
  {busy&&!data&&<p role="status">Chargement des priorités…</p>}
  {data&&<>
   <section className={`owner-priority-panel ${priority.length?'has-priorities':'is-clear'}`} aria-labelledby="owner-priorities"><h2 id="owner-priorities">À vérifier en priorité</h2>{priority.length?<><p>Ces situations demandent un examen ; leur gravité reste à vérifier.</p><ul>{priority.map(row)}</ul></>:<p>Aucun signalement en attente ni espace actif sans administrateur détecté.</p>}</section>
   <section className="owner-task-panel" aria-labelledby="owner-tasks"><h2 id="owner-tasks">Actions requises</h2>{tasks.length?<ul>{tasks.map(row)}</ul>:<p>Aucune demande d’espace ou de passage en Pro à traiter.</p>}</section>
   {(data.suspendedSpaces>0||data.pendingRefunds>0)&&<section className="owner-watch-panel"><h2>À suivre</h2><p>Ces états ne signifient pas nécessairement qu’une intervention urgente est requise.</p><div className="management-actions">{data.suspendedSpaces>0&&<a href="/mon-espace?alerte=suspendus#espaces">{data.suspendedSpaces} espace(s) suspendu(s) →</a>}{data.pendingRefunds>0&&<a href="/mon-espace#suivi-belconnect">{data.pendingRefunds} remboursement(s) en cours →</a>}</div></section>}
   <footer className="owner-dashboard-summary"><span>{data.activeSpaces} espaces actifs</span><span>{data.activeMembers} comptes actifs hors propriétaires</span><a href="/mon-espace#suivi-belconnect">Ouvrir le suivi détaillé →</a></footer>
  </>}
  <p className="dashboard-metric-note">Situation actuelle · données locales en mode test · espace de démonstration exclu des indicateurs d’espaces. {updated&&`Actualisé à ${updated.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}.`}</p>
 </div>;
}
