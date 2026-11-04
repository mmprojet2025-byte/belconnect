import { OwnerDashboardCharts } from "./DashboardCharts";
import { useEffect, useState } from 'react';
import { result } from '../lib/auth';
import './OwnerStatistics.css';
type Subscription = {spaceId:number;spaceName:string;spaceStatus:string;plan:string;status:string;terminatedSubscription:boolean};
export function OwnerStatistics() {
 const [rows,setRows]=useState<Subscription[]|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[updated,setUpdated]=useState<Date|null>(null);
 useEffect(()=>{const c=new AbortController();fetch('/api/workspace/owner/subscriptions',{credentials:'same-origin',cache:'no-store',signal:c.signal}).then(result).then(data=>{setRows(data);setError('');setUpdated(new Date());}).catch(()=>{if(!c.signal.aborted)setError('Statistiques indisponibles. Réessayez.');}).finally(()=>{if(!c.signal.aborted)setBusy(false);});return()=>c.abort();},[revision]);
 const active=rows?.filter(x=>x.plan==='PRO'&&x.status==='ACTIF'&&!x.terminatedSubscription)??[];
 const ended=rows?.filter(x=>x.terminatedSubscription)??[];
 const max=Math.max(1,active.length,ended.length);
 const bars=[{label:'Abonnements actifs',count:active.length,items:active,kind:'active'},{label:'Abonnements résiliés',count:ended.length,items:ended,kind:'ended'}];
 return <section className="owner-statistics" aria-labelledby="statistics-title" aria-busy={busy}>
 <header className="workspace-context-header"><div className="account-section-heading"><div><span className="workspace-context-kicker">Pilotage de BelConnect</span><h2 id="statistics-title">Statistiques</h2><p>Abonnements des espaces · situation actuelle</p></div><button className="button outline" disabled={busy} onClick={()=>{setBusy(true);setError('');setRevision(x=>x+1);}}>Actualiser</button></div></header>
 <p className="statistics-mode">Données de l’environnement de test · espace de démonstration exclu</p>
 {error?<p role="alert">{error}</p>:!rows?<p role="status">Chargement des abonnements…</p>:<>
 <div className="statistics-totals">{bars.map(b=><article key={b.kind} className={b.kind}><span>{b.label}</span><strong>{b.count}</strong><small>{b.kind==='active'?'Espaces avec une formule Pro active':'Abonnements définitivement terminés'}</small></article>)}</div>
 <figure className="statistics-chart"><figcaption>Répartition des abonnements</figcaption><p>Nombre d’espaces · même échelle pour les deux barres</p>{bars.map(b=><div className="statistics-row" key={b.kind}><div><span><i className={b.kind} aria-hidden="true" />{b.label}</span><strong>{b.count}</strong></div><div className="statistics-track" aria-hidden="true"><span className={b.kind} style={{width:`${b.count/max*100}%`}} /></div></div>)}{!active.length&&!ended.length&&<p>Aucun abonnement actif ou résilié enregistré actuellement.</p>}</figure>
 <details className="statistics-details"><summary>Autres graphiques : commissions et formules</summary><OwnerDashboardCharts key={revision} /></details>
 <details className="statistics-details"><summary>Voir les espaces concernés</summary>{bars.map(b=><div key={b.kind}><h3>{b.label}</h3>{b.items.length?<ul>{b.items.map(x=><li key={x.spaceId}>{x.spaceName}</li>)}</ul>:<p>Aucun espace dans cette catégorie.</p>}</div>)}<a className="button outline" href="/mon-espace#abonnements-factures">Gérer les abonnements →</a></details>
 <details className="statistics-details"><summary>Comment ces chiffres sont calculés</summary><p>Actifs : formule Pro avec statut actif. Résiliés : abonnement Stripe enregistré et marqué comme définitivement terminé. Les paiements abandonnés, les demandes en attente et les espaces gratuits ne sont pas comptés comme résiliations.</p><p>Ce graphique décrit le dernier état connu de chaque espace, y compris les espaces suspendus. Il ne compte pas les anciennes résiliations suivies d’un réabonnement. Il ne représente donc ni l’historique des résiliations, ni un taux d’attrition mensuel. Les données sont synchronisées par les confirmations Stripe.</p></details>
 <p className="dashboard-metric-note">Actualisé à {updated?.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})} · {rows.length} espaces examinés</p>
 </>}
 </section>;
}
