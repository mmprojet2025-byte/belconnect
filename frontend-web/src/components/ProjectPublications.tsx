import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { PaidProjectOfferEditor } from './PaidProjectParticipation';
type Managed = { id: number; title: string; spaceId: number; spaceName: string; visibility: string; published: boolean; version: number };
function Publication({ project, onSaved, settlementOnly }: { project: Managed; onSaved: (p: Managed) => void; settlementOnly: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { const updated = await postJson(`/api/project-publications/${project.id}`, { version: project.version, published: !project.published }); onSaved(updated); setConfirm(false); }
    catch(e) { setError(e instanceof Error ? e.message : 'Impossible de modifier la publication.'); }
    finally { setBusy(false); }
  }
  return <article className="workspace-card"><span className="account-status">{project.published ? 'Publié' : 'Approuvé · Non publié'}</span><h3>{project.title}</h3><p>{project.spaceName}</p><p>{project.visibility === 'GROUPE' ? 'Visibilité : membres actifs du groupe uniquement.' : 'Visibilité : publique, accessible sans compte.'}</p>{!settlementOnly && (confirm ? <div className="account-cancel-confirm"><p>{project.published ? 'Retirer ce projet du catalogue ? Il restera approuvé et pourra être republié.' : `Publier ce projet ? Son titre, sa description, son objectif et ses dates seront accessibles ${project.visibility === 'GROUPE' ? 'aux membres actifs du groupe' : 'à tous les visiteurs'}. Les commentaires de validation restent privés.`}</p><div className="publication-actions"><button className="button coral" disabled={busy} onClick={save}>{busy ? 'Enregistrement…' : project.published ? 'Confirmer le retrait' : 'Confirmer la publication'}</button><button className="text-link" disabled={busy} onClick={() => setConfirm(false)}>Annuler</button></div></div> : <div className="publication-actions"><button className="button outline" onClick={() => setConfirm(true)}>{project.published ? 'Retirer du catalogue' : 'Publier le projet'}</button>{project.published && project.visibility === 'PUBLIQUE' && <a className="text-link" href={`/projets/${project.id}`}>Voir le projet</a>}</div>)}{(!settlementOnly || project.published) && <PaidProjectOfferEditor projectId={project.id} settlementOnly={settlementOnly} />}{error && <p role="alert">{error}</p>}</article>;
}
export function ProjectPublications({ spaceId, settlementOnly = false }: { spaceId?: number; settlementOnly?: boolean }) {
  const [items, setItems] = useState<Managed[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/project-publications', { credentials:'same-origin', cache:'no-store', signal:AbortSignal.any([c.signal,AbortSignal.timeout(15000)]) }).then(result).then(setItems).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Liste indisponible.'); });
    return () => c.abort();
  }, [attempt]);
  const visible = items?.filter(project => (spaceId === undefined || project.spaceId === spaceId) && (!settlementOnly || project.published));
  return <section aria-labelledby="publications-title"><div className="account-section-heading"><h2 id="publications-title">{settlementOnly ? 'Projets à régulariser' : 'Publication des projets approuvés'}</h2><button className="text-link" onClick={() => { setError('');setItems(null);setAttempt(n=>n+1); }}>Actualiser les publications</button></div>{notice && <p role="status">{notice}</p>}{error ? <p role="alert">{error}</p> : visible === null || visible === undefined ? <p role="status">Chargement des publications…</p> : !visible.length ? <p>{settlementOnly ? 'Aucun projet publié dans cet espace.' : 'Aucun projet approuvé à publier dans cet espace.'}</p> : <div className="workspace-grid">{visible.map(p => <Publication key={`${p.id}-${p.version}`} project={p} settlementOnly={settlementOnly} onSaved={updated => { setItems(current => current?.map(item => item.id === updated.id ? updated : item) ?? null); setNotice(updated.published ? 'Projet publié selon sa visibilité.' : 'Projet retiré du catalogue.'); }} />)}</div>}</section>;
}
