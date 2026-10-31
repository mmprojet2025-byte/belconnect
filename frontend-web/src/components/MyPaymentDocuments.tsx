import { Icon } from './Icon';
import { useEffect, useState } from 'react';
import { result, HttpError } from '../lib/auth';
type Payment = { key:string; title:string; amount:number; status:string; href:string; type:string };
type ActivityPayment = { id:number; activityId:string; title:string; amountCents:number; status:string };
type ProjectPayment = { id:number; projectId:number; projectTitle:string; priceCents:number; amountCents:number; status:string };
const labels:Record<string,string> = {PAYE:'Paiement confirmé',EN_ATTENTE:'En attente',REMBOURSE:'Remboursé',REMBOURSEMENT_EN_COURS:'Remboursement en cours',ECHOUE:'Échoué',EXPIRE:'Expiré'};
export function MyPaymentDocuments() {
 const [items,setItems]=useState<Payment[]|null>(null);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [search,setSearch]=useState('');
 const [documents,setDocuments]=useState<Record<string,{url:string;testMode:boolean}>>({});
 const [documentErrors,setDocumentErrors]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState<string|null>(null);
 async function loadDocument(p:Payment) {
  setLoading(p.key);setDocumentErrors(v=>({...v,[p.key]:''}));
  try {
   const [type,id]=p.key.split('-');
   const doc=await fetch(`/api/my-payment-documents/${type}/${id}`,{credentials:'same-origin',cache:'no-store'}).then(result);
   const url=new URL(doc.url);
   if(url.protocol!=='https:'||url.hostname!=='pay.stripe.com'||url.username||url.password||url.port)throw new Error('Lien de reçu invalide.');
   setDocuments(v=>({...v,[p.key]:doc}));
  } catch(cause) {setDocumentErrors(v=>({...v,[p.key]:cause instanceof HttpError && cause.status===401 ? 'Votre session a expiré. Reconnectez-vous pour obtenir votre reçu.' : 'Reçu indisponible pour le moment. Réessayez.'}));}
  finally {setLoading(null);}
 }
 useEffect(()=>{
  const c=new AbortController(); setError(''); setItems(null);
  const get=(url:string)=>fetch(url,{credentials:'same-origin',cache:'no-store',signal:c.signal}).then(result);
  Promise.all([get('/api/paid-activity-bookings'),get('/api/project-paid-participations'),get('/api/project-donations')]).then(([activities,projects,donations]:[ActivityPayment[],ProjectPayment[],ProjectPayment[]])=>{
   if(c.signal.aborted)return;
   setItems([...activities.map(p=>({key:`activity-${p.id}`,title:p.title,amount:p.amountCents,status:p.status,href:`/activites/${p.activityId}`,type:'Activité'})),...projects.map(p=>({key:`project-${p.id}`,title:p.projectTitle,amount:p.priceCents,status:p.status,href:`/projets/${p.projectId}`,type:'Projet'})),...donations.map(p=>({key:`donation-${p.id}`,title:p.projectTitle,amount:p.amountCents,status:p.status,href:`/projets/${p.projectId}`,type:'Don'}))]);
  }).catch(()=>{if(!c.signal.aborted)setError('Impossible de charger vos paiements. Réessayez.');});
  return ()=>c.abort();
 },[refresh]);
 const visible=items?.filter(p=>p.title.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
 return <section aria-label="Mes factures"><div className="account-section-heading"><h2>Mes factures</h2><button className="button outline" onClick={()=>setRefresh(v=>v+1)}>Actualiser</button></div>
 <p className="account-notice">Retrouvez vos paiements d’activités, de projets et vos dons. Vous pouvez ouvrir le reçu Stripe de chaque paiement confirmé, puis l’imprimer ou l’enregistrer en PDF. Un reçu de paiement ne remplace pas une facture : pour une facture, contactez l’organisateur.</p>
 <div className="payment-document-search"><label htmlFor="payment-document-query">Rechercher un paiement</label><div className="payment-document-search-field"><Icon name="search" /><input id="payment-document-query" type="search" placeholder="Nom d’une activité ou d’un projet…" value={search} onChange={e=>setSearch(e.target.value)} /></div><p>Retrouvez rapidement le paiement et son reçu.</p></div>
 {error&&<p role="alert">{error}</p>}{!items&&!error&&<p role="status">Chargement…</p>}
 {visible?.length===0&&<p>Aucun paiement à afficher{search?' pour cette recherche':''}.</p>}
 {visible?.map(p=><article className="account-booking-card" key={p.key}><span className="account-status">{labels[p.status]??'État à vérifier'}</span><h3><a href={p.href}>{p.title}</a></h3><p>{p.type} · {(p.amount/100).toLocaleString('fr-BE',{style:'currency',currency:'EUR'})}</p>{['PAYE','REMBOURSE','REMBOURSEMENT_EN_COURS'].includes(p.status) ? <div>{documents[p.key] ? <><a className="button outline" href={documents[p.key].url} target="_blank" rel="noopener noreferrer">Ouvrir le reçu Stripe</a>{documents[p.key].testMode&&<p>Reçu de test · aucun débit réel.</p>}</> : <button className="button outline" disabled={loading!==null} onClick={()=>void loadDocument(p)}>{loading===p.key?'Préparation du reçu…':'Obtenir mon reçu'}</button>}{documentErrors[p.key]&&<p role="alert">{documentErrors[p.key]}</p>}</div> : <p>Le reçu sera disponible après confirmation du paiement.</p>}</article>)}
 </section>;
}
