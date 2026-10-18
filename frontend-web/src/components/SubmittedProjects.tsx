import { useEffect, useState } from 'react';
import { ReviewHistory } from './ReviewHistory';
import type { Review } from './ReviewHistory';
import { postJson, result } from '../lib/auth';
export type SubmittedProject = { id: number; title: string; description: string; objective: string; spaceName: string; groupName: string | null; reviewStage: string | null; submittedAt: string; startsOn: string | null; endsOn: string | null; version: number; canReview: boolean; canDecide: boolean; status: string; reviews: Review[] };
import { stageLabel } from '../lib/projects';
function ProjectContent({ project }: { project: SubmittedProject }) {
  return <div className="submitted-content"><p>{project.spaceName}{project.groupName && ` · ${project.groupName}`}</p><span className="account-status">{project.status === 'APPROUVE' ? 'Approuvé' : project.status === 'REFUSE' ? 'Refusé' : stageLabel(project.reviewStage)}</span><h4>Description</h4><p>{project.description}</p><h4>Objectif</h4><p>{project.objective}</p>{(project.startsOn || project.endsOn) && <p>Dates prévues : {project.startsOn || 'début non précisé'} — {project.endsOn || 'fin non précisée'}</p>}{project.submittedAt && <p>Soumis le {new Date(project.submittedAt).toLocaleString('fr-BE')}</p>}<ReviewHistory reviews={project.reviews} /><p>{project.status === 'SOUMIS' ? 'Le projet n’est pas publié. L’administrateur prend la décision finale.' : project.status === 'REFUSE' ? 'Ce projet a été refusé et n’est pas publié.' : 'Le projet est approuvé. Sa publication est gérée séparément par l’administrateur de l’espace.'}</p></div>;
}
export function SubmittedDetail({ id }: { id: number }) {
  const [project, setProject] = useState<SubmittedProject | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/project-reviews/${id}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) }).then(result).then(setProject).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Projet indisponible.'); });
    return () => c.abort();
  }, [id, retry]);
  return error ? <div role="alert"><p>{error}</p><button className="text-link" onClick={() => { setError(''); setRetry(n => n + 1); }}>Réessayer</button></div> : project ? <ProjectContent project={project} /> : <p role="status">Chargement du projet…</p>;
}
function OpinionForm({ project, onDone, final = false }: { final?: boolean; project: SubmittedProject; onDone: (message: string) => void }) {
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState<'AVIS_FAVORABLE' | 'A_CORRIGER' | 'APPROUVE' | 'REFUSE' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (!decision) return;
    setBusy(true); setError('');
    try {
      await postJson(`/api/project-reviews/${project.id}/${final ? 'decision' : 'opinion'}`, { version: project.version, decision, comment: comment.trim() });
      onDone(final ? (decision === 'APPROUVE' ? 'Projet approuvé. La décision est visible par l’auteur.' : 'Projet refusé. Le motif est visible par l’auteur.') : decision === 'A_CORRIGER' ? 'Demande de correction enregistrée et visible par l’auteur.' : 'Avis favorable enregistré. Le projet attend la décision de l’administrateur.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer cet avis.'); }
    finally { setBusy(false); }
  }
  return <div className="opinion-form"><h4>{final ? 'Décision de l’administrateur' : 'Votre avis de référent'}</h4><label htmlFor={`opinion-${project.id}`}>{final ? 'Commentaire — obligatoire pour refuser le projet' : 'Commentaire — obligatoire pour demander des corrections'}</label><textarea id={`opinion-${project.id}`} rows={4} maxLength={3000} value={comment} disabled={busy} onChange={e => { setComment(e.target.value); setDecision(null); }} placeholder="Précisez les points à revoir ou les éléments qui motivent votre avis." />
    {!decision ? <div className="opinion-actions"><button className="button outline" disabled={!comment.trim() || busy} onClick={() => setDecision(final ? 'REFUSE' : 'A_CORRIGER')}>{final ? 'Refuser le projet' : 'Demander des corrections'}</button><button className="button coral" disabled={busy} onClick={() => setDecision(final ? 'APPROUVE' : 'AVIS_FAVORABLE')}>{final ? 'Approuver le projet' : 'Donner un avis favorable'}</button></div> : <div className="account-cancel-confirm"><p>{final ? `Confirmer ${decision === 'APPROUVE' ? 'l’approbation' : 'le refus'} de ce projet ? Cette décision sera visible par l’auteur et ne sera plus modifiable ici.` : decision === 'A_CORRIGER' ? 'Confirmer le retour du projet à son auteur pour correction ? Votre commentaire lui sera visible.' : 'Confirmer cet avis favorable ? Le projet sera transmis à l’administrateur et ne sera pas publié.'}</p><button className="button coral" disabled={busy} onClick={send}>{busy ? 'Enregistrement…' : final ? 'Confirmer la décision' : 'Confirmer mon avis'}</button><button className="text-link" disabled={busy} onClick={() => setDecision(null)}>Revenir au commentaire</button></div>}
    {error && <p role="alert" className="draft-error">{error} Votre commentaire est conservé.</p>}
  </div>;
}
export function ProjectInbox() {
  const [notice, setNotice] = useState('');
  const [projects, setProjects] = useState<SubmittedProject[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/project-reviews', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) }).then(result).then(setProjects).catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Dossiers indisponibles.'); });
    return () => c.abort();
  }, [retry]);
  return <section aria-labelledby="review-inbox"><div className="account-section-heading"><h2 id="review-inbox">Projets reçus pour validation</h2><button className="text-link" onClick={() => { setError(''); setProjects(null); setRetry(n => n + 1); }}>Actualiser</button></div>{notice && <p className="account-notice" role="status">{notice}</p>}{error ? <p role="alert">{error}</p> : projects === null ? <p role="status">Chargement des projets reçus…</p> : !projects.length ? <p className="workspace-card">Aucun projet soumis à examiner dans vos espaces ou groupes.</p> : projects.map(project => <details className="workspace-card submitted-project" key={project.id}><summary>{project.title} · #{project.id}</summary><ProjectContent project={project} />{(project.canReview || project.canDecide) && <OpinionForm final={project.canDecide} project={project} onDone={message => { setNotice(message); setProjects(current => current?.filter(p => p.id !== project.id) ?? null); }} />}</details>)}</section>;
}
