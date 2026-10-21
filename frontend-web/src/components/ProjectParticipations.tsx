import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { helpTypes } from '../lib/helpTypes';
const statuses: Record<string,string> = { PROPOSEE:'En attente de réponse', ACCEPTEE:'Aide acceptée', REFUSEE:'Aide refusée', ANNULEE:'Proposition annulée' };
type Participation = { id:number; projectId:number; spaceId:number; title:string; spaceName:string; type:string; message:string; status:string; reason:string; version:number; createdAt:string; participant:string };
export function ProposeHelp({ projectId, signedIn, availableTypes }: { projectId:number; signedIn:boolean; availableTypes:string[] }) {
  const [type,setType] = useState(availableTypes[0]);
  const [message,setMessage] = useState('');
  const [requestId,setRequestId] = useState(() => crypto.randomUUID());
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [sent,setSent] = useState<Participation | null>(null);
  async function send(event:React.FormEvent) {
    event.preventDefault(); if(busy)return;
    setBusy(true);setError('');
    try { setSent(await postJson('/api/project-participations',{ projectId,requestId,type:availableTypes.includes(type)?type:availableTypes[0],message:message.trim() })); }
    catch(e) {setError(e instanceof Error ? e.message : 'Impossible d’envoyer votre proposition.');}
    finally {setBusy(false);}
  }
  return <section className="project-help" aria-labelledby="help-title"><h2 id="help-title">Et si vous apportiez votre aide ?</h2><p>Ce projet recherche : {availableTypes.map(value => helpTypes[value]).join(', ')}. Proposez une aide gratuite. Votre proposition attendra la réponse de l’administrateur ; elle ne réserve aucune place et ne vous inscrit pas dans un groupe.</p>{!signedIn ? <a className="button coral" href={`/connexion?retour=${encodeURIComponent(`/projets/${projectId}`)}`}>Se connecter pour proposer son aide</a> : sent ? <div><p role="status">{statuses[sent.status]}. Retrouvez votre proposition dans « Mes aides aux projets ».</p><a className="button outline" href="/mon-espace#aides-projets">Voir mes aides aux projets</a><button className="text-link" onClick={() => {setSent(null);setMessage('');setRequestId(crypto.randomUUID());}}>Proposer une autre aide</button></div> : <form onSubmit={send}><label>Comment souhaitez-vous aider ?<select value={availableTypes.includes(type)?type:availableTypes[0]} disabled={busy} onChange={e=>setType(e.target.value)}>{availableTypes.map(value=><option key={value} value={value}>{helpTypes[value]}</option>)}</select></label><label>Votre proposition (facultatif)<textarea rows={4} maxLength={1000} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder="Précisez ce que vous souhaitez apporter au projet." /></label><p>Votre nom et votre message seront visibles par l’administrateur de l’espace.</p><button className="button coral" disabled={busy}>{busy?'Envoi…':'Envoyer ma proposition'}</button>{error && <p role="alert">{error} Votre saisie est conservée.</p>}</form>}</section>;
}
function ParticipationCard({ item,received,onSaved }: { item:Participation;received:boolean;onSaved:(p:Participation)=>void }) {
  const [action,setAction] = useState('');
  const [reason,setReason] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function send() {
    setBusy(true);setError('');
    try {onSaved(await postJson(`/api/project-participations/${item.id}/${received?'decision':'cancel'}`,received?{version:item.version,status:action,reason:reason.trim()}:{version:item.version}));}
    catch(e) {setError(e instanceof Error?e.message:'Impossible d’enregistrer cette action.');}
    finally {setBusy(false);}
  }
  return <article className="workspace-card"><span className="account-status">{statuses[item.status]}</span><h3>{item.title}</h3><p>{item.spaceName} · {helpTypes[item.type]}</p>{received && <p><strong>{item.participant}</strong></p>}{item.message && <p className="project-copy">{item.message}</p>}{item.reason && <p className="project-copy"><strong>Réponse de l’administrateur : </strong>{item.reason}</p>}<p>Proposée le {new Date(item.createdAt).toLocaleDateString('fr-BE')}</p>{received ? item.status==='PROPOSEE' && <div className="project-help-controls"><label>Réponse (obligatoire pour refuser)<textarea rows={3} maxLength={1000} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setAction('');}} /></label>{!action && <div className="publication-actions"><button className="button coral" onClick={()=>setAction('ACCEPTEE')}>Accepter l’aide</button><button className="button outline" disabled={!reason.trim()} onClick={()=>setAction('REFUSEE')}>Refuser l’aide</button></div>}</div> : ['PROPOSEE','ACCEPTEE'].includes(item.status) && !action && <button className="text-link" onClick={()=>setAction('ANNULEE')}>Annuler ma proposition</button>}{action && <div className="account-cancel-confirm"><p>{action==='ANNULEE'?'Annuler votre proposition d’aide ?':`Confirmer ${action==='ACCEPTEE'?'l’acceptation':'le refus'} de cette aide ?`}</p><div className="publication-actions"><button className="button coral" disabled={busy} onClick={send}>{busy?'Enregistrement…':'Confirmer'}</button><button className="text-link" disabled={busy} onClick={()=>setAction('')}>Revenir</button></div></div>}{error && <p role="alert">{error}</p>}</article>;
}
export function ProjectParticipations({ received=false, spaceId }: { received?:boolean; spaceId?:number }) {
  const [items,setItems] = useState<Participation[]|null>(null);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const [notice,setNotice] = useState('');
  useEffect(()=>{
    const c=new AbortController();
    fetch(`/api/project-participations${received?'/received':''}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)])}).then(result).then(setItems).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Liste indisponible.');});
    return ()=>c.abort();
  },[received,attempt]);
  const visible = items?.filter(item => spaceId === undefined || item.spaceId === spaceId);
  return <section id={received?'aides-recues':'aides-projets'}><div className="account-section-heading"><h2>{received?'Propositions d’aide reçues':'Mes aides aux projets'}</h2><button className="text-link" onClick={()=>{setItems(null);setError('');setAttempt(n=>n+1);}}>Actualiser les aides{received?' reçues':''}</button></div>{notice && <p role="status">{notice}</p>}{error ? <p role="alert">{error}</p> : visible===null || visible===undefined ? <p role="status">Chargement des propositions…</p> : !visible.length ? <div className="workspace-card"><p>{received?'Aucune proposition reçue pour cet espace.':'Vous n’avez pas encore proposé votre aide à un projet.'}</p>{!received && <a className="button outline" href="/projets">Découvrir les projets</a>}</div> : <div className="workspace-grid">{visible.map(item=><ParticipationCard key={`${item.id}-${item.version}`} item={item} received={received} onSaved={updated=>{setItems(current=>current?.map(p=>p.id===updated.id?updated:p)??null);setNotice(statuses[updated.status]);}} />)}</div>}</section>;
}
