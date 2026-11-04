import { useEffect, useState } from 'react';
import './OwnerDashboard.css';
import { result } from '../lib/auth';
type Alerts = {failedChecks:number;lastFailure:string|null;failedPayments:number;settledPayments:number;paymentThreshold:boolean;checkedAt:string};
export function OwnerOperationalAlerts({ revision = 0, mode = 'all' }: { revision?:number; mode?:'all'|'security'|'payments' }) {
 const [refresh,setRefresh]=useState(0);
 const [data,setData]=useState<Alerts|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/workspace/owner/dashboard/alerts',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(result).then(value=>{setData(value);setError(false);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[revision,refresh]);
 if(mode==='all') return <section className="owner-priority-panel operational-panel"><h2>Sécurité et paiements</h2>{error?<p role="alert">Indicateurs indisponibles. Utilisez Actualiser.</p>:!data?<p role="status">Chargement…</p>:<div className="operational-summary"><a href="/mon-espace#securite"><strong>Sécurité</strong><span>{data.failedChecks>=5?`${data.failedChecks} échecs récents · à vérifier`:'Aucun seuil atteint'}</span><span aria-hidden="true">→</span></a><a href="/mon-espace#suivi-belconnect"><strong>Paiements</strong><span>{data.paymentThreshold?'Seuil d’échecs atteint':data.settledPayments<10?'Pas assez de résultats pour évaluer le taux':'Aucun seuil atteint'}</span><span aria-hidden="true">→</span></a></div>}<p className="dashboard-metric-note">Contrôles partiels · détails et limites dans chaque rubrique.</p></section>;
 return <section className="owner-priority-panel operational-panel" aria-labelledby="operational-alerts-title"><h2 id="operational-alerts-title">{mode==='security'?'Alertes de connexion':mode==='payments'?'Alertes de paiement':'Sécurité et paiements'}</h2>{<button className="button outline" onClick={()=>{setError(false);setRefresh(n=>n+1);}}>Actualiser</button>}
 {error?<p role="alert">Contrôles indisponibles. Impossible de confirmer la situation ; utilisez Actualiser.</p>:!data?<p role="status">Vérification des indicateurs…</p>:<>
 <div className="operational-grid" style={{gridTemplateColumns:'1fr'}}>
 {mode!=='payments'&&<article className={data.failedChecks>=5?'operational-tile needs-review':'operational-tile'}>
 <div className="operational-tile-heading"><h3>Votre compte</h3><span className={data.failedChecks>=5?'operational-status warning':'operational-status'}>{data.failedChecks>=5?'À vérifier':'Seuil non atteint'}</span></div>
 <strong className="operational-number">{data.failedChecks} <small>échec{data.failedChecks>1?'s':''}</small></strong><p>Sur les 15 dernières minutes</p>

 </article>}
 {mode!=='security'&&<article className={data.paymentThreshold?'operational-tile needs-review':'operational-tile'}>
 <div className="operational-tile-heading"><h3>Paiements</h3><span className={data.paymentThreshold?'operational-status warning':'operational-status'}>{data.paymentThreshold?'À vérifier':data.settledPayments<10?'Volume insuffisant':'Seuil non atteint'}</span></div>
 <strong className="operational-number">{data.failedPayments} <small>échec{data.failedPayments>1?'s':''} / {data.settledPayments}</small></strong><p>Tentatives avec résultat connu · créées depuis 24 h</p>

 </article>}
 </div>
 <div className="operational-meta"><span>Mis à jour à {new Date(data.checkedAt).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}</span><span>Alertes à l’écran uniquement</span></div>
 <details><summary>Seuils et méthode de calcul</summary><p>Sécurité : au moins 5 échecs enregistrés pour votre compte sur 15 minutes. Les requêtes déjà bloquées par la limitation ne sont pas toutes comptées dans ce journal.</p><p>Paiements : au moins 10 tentatives avec résultat connu et 30 % d’échecs, parmi celles créées depuis 24 heures. Les expirations et paiements en attente sont exclus. Les refus de carte non remontés dans ces états ne sont pas comptés. Activités et projets uniquement, hors dons et abonnements. Les données actuelles incluent les essais Stripe : ce seuil est un repère à ajuster, pas une détection automatique de fraude.</p></details>
 </>}
 <details><summary>Non surveillé actuellement</summary><ul className="operational-coverage"><li>Nouveaux appareils et blocages IP</li><li>E-mails rejetés et alertes par e-mail</li><li>Pannes de services externes</li></ul><p>L’absence d’alerte ne garantit pas l’absence d’incident.</p></details>
 </section>;
}
