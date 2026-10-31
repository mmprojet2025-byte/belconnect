import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { PaidProjectOfferEditor } from './PaidProjectParticipation';
type Managed = { id: number; title: string; spaceId: number; spaceName: string; visibility: string; published: boolean; finished: boolean; version: number };
function Publication({ project, onSaved, settlementOnly }: { project: Managed; onSaved: (p: Managed) => void; settlementOnly: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { const updated = await postJson(`/api/project-publications/${project.id}`, { version: project.version, published: !project.published }); onSaved(updated); setConfirm(false); }
    catch(e) { setError(e instanceof Error ? e.message : 'Impossible de modifier la publication.'); }
    finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true); setError('');
    try { const updated = await postJson(`/api/project-publications/${project.id}/finish`, { version: project.version }); onSaved(updated); setConfirmFinish(false); }
    catch(e) { setError(e instanceof Error ? e.message : 'Impossible de terminer ce projet.'); }
    finally { setBusy(false); }
  }
  return <details className="managed-activity-row"><summary><span className="managed-activity-row-title">{project.title}</span><span className="account-status">{project.finished ? 'Terminé' : project.published ? 'Publié' : 'Approuvé'}</span></summary><div className="workspace-card"><span className="account-status">{project.finished ? 'Terminé' : project.published ? 'Publié' : 'Approuvé · Non publié'}</span><h3>{project.title}</h3><p>{project.spaceName}</p><p>{project.visibility === 'GROUPE' ? 'Visibilité : membres actifs du groupe uniquement.' : 'Visibilité : publique, accessible sans compte.'}</p>{!settlementOnly && !project.finished && (confirm ? <div className="account-cancel-confirm"><p>{project.published ? 'Retirer ce projet du catalogue ? Il restera approuvé et pourra être republié.' : `Publier ce projet ? Son titre, sa description, son objectif et ses dates seront accessibles ${project.visibility === 'GROUPE' ? 'aux membres actifs du groupe' : 'à tous les visiteurs'}. Les commentaires de validation restent privés.`}</p><div className="publication-actions"><button className="button coral" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : project.published ? 'Confirmer le retrait' : 'Confirmer la publication'}</button><button className="text-link" disabled={busy} onClick={() => setConfirm(false)}>Annuler</button></div></div> : <div className="publication-actions"><button className="button outline" onClick={() => setConfirm(true)}>{project.published ? 'Retirer du catalogue' : 'Publier le projet'}</button>{project.published && project.visibility === 'PUBLIQUE' && <a className="text-link" href={`/projets/${project.id}`}>Voir le projet</a>}</div>)}{!settlementOnly && !project.finished && (confirmFinish ? <div className="account-cancel-confirm"><p>Terminer ce projet ? Il quittera le catalogue et ne pourra plus être republié. Fermez d’abord toute offre d’inscription active et traitez les remboursements éventuels.</p><div className="publication-actions"><button className="button coral" disabled={busy} onClick={finish}>Confirmer la fin du projet</button><button className="button outline" disabled={busy} onClick={() => setConfirmFinish(false)}>Annuler</button></div></div> : <button className="text-link" onClick={() => setConfirmFinish(true)}>Terminer le projet</button>)}{!project.finished && (!settlementOnly || project.published) && <details className="space-payment-details"><summary>Configurer les inscriptions et le tarif</summary><PaidProjectOfferEditor projectId={project.id} settlementOnly={settlementOnly} /></details>}{error && <p role="alert">{error}</p>}</div></details>;
}
export function ProjectPublications({ spaceId, settlementOnly = false }: { spaceId?: number; settlementOnly?: boolean }) {
  const [items, setItems] = useState<Managed[] | null>(null);
  const [total, setTotal] = useState(0);
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const c = new AbortController();
    const mode = settlementOnly ? 'SETTLEMENT' : history ? 'HISTORY' : 'ACTIVE';
    fetch(`/api/project-publications/paged?mode=${mode}&page=${page}${spaceId === undefined ? '' : `&spaceId=${spaceId}`}`, { credentials:'same-origin', cache:'no-store', signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)]) }).then(result).then(value => { setItems(value.items); setTotal(value.total); setError(''); }).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Liste indisponible.'); });
    return () => c.abort();
  }, [attempt, history, page, spaceId, settlementOnly]);
  const visible = items;
  return <section aria-labelledby="publications-title"><div className="account-section-heading"><h2 id="publications-title">{settlementOnly ? 'Projets à régulariser' : 'Publication des projets approuvés'}</h2><button className="text-link" onClick={() => { setError('');setItems(null);setAttempt(n=>n+1); }}>Actualiser les publications</button></div>{!settlementOnly && <div className="account-filters" aria-label="Filtrer les projets administrés"><button aria-pressed={!history} onClick={() => {setItems(null);setHistory(false);setPage(0);}}>En cours</button><button aria-pressed={history} onClick={() => {setItems(null);setHistory(true);setPage(0);}}>Historique</button></div>}{notice && <p role="status">{notice}</p>}{error ? <p role="alert">{error}</p> : visible === null || visible === undefined ? <p role="status">Chargement des publications…</p> : !visible.length ? <p>{settlementOnly ? 'Aucun projet publié dans cet espace.' : history ? 'Aucun projet terminé.' : 'Aucun projet approuvé à publier dans cet espace.'}</p> : <><div className="managed-activity-list">{visible.map(p => <Publication key={`${p.id}-${p.version}`} project={p} settlementOnly={settlementOnly} onSaved={updated => { setNotice(updated.finished ? 'Projet terminé et retiré du catalogue.' : updated.published ? 'Projet publié selon sa visibilité.' : 'Projet retiré du catalogue.'); setItems(null); setPage(0); setAttempt(value=>value+1); }} />)}</div>{total>12 && <div className="management-actions"><button className="button outline" disabled={page===0} onClick={() => {setItems(null);setPage(value=>value-1);}}>Précédent</button><span>Page {page+1} sur {Math.ceil(total/12)}</span><button className="button outline" disabled={(page+1)*12>=total} onClick={() => {setItems(null);setPage(value=>value+1);}}>Suivant</button></div>}</>}</section>;
}
