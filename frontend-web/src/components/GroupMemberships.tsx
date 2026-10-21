import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';

type Request = { id: number; groupId: number; spaceId: number; groupName: string; spaceName: string; applicant: string; status: string; membershipStatus: string; reason: string; version: number; available: boolean };
const labels: Record<string, string> = { EN_ATTENTE: 'En attente', ACCEPTEE: 'Acceptée', REFUSEE: 'Refusée' };
const message = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur.';
function DecisionForm({ request, onDone }: { request: Request; onDone: () => void }) {
  const [decision, setDecision] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await postJson(`/api/group-memberships/${request.id}/decision`, { version: request.version, status: decision, reason: reason.trim() }); onDone(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  if (!decision) return <div className="management-actions"><button className="button coral" onClick={() => setDecision('ACCEPTEE')}>Accepter</button><button className="button outline" onClick={() => setDecision('REFUSEE')}>Refuser</button></div>;
  return <form className="draft-editor" onSubmit={submit}><p>{decision === 'ACCEPTEE' ? `${request.applicant} deviendra membre de ce groupe et de son espace.` : 'Le motif sera visible par le demandeur.'}</p><fieldset disabled={busy}>{decision === 'REFUSEE' && <label>Motif du refus<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}<div className="management-actions"><button className="button coral">{busy ? 'Enregistrement…' : decision === 'ACCEPTEE' ? 'Confirmer l’adhésion' : 'Confirmer le refus'}</button><button type="button" className="button outline" onClick={() => { setDecision(null); setReason(''); setError(''); }}>Annuler</button></div></fieldset>{error && <p className="draft-error" role="alert">{error}</p>}</form>;
}
export function GroupMemberships({ received = false, onChanged, spaceId }: { received?: boolean; onChanged?: () => void; spaceId?: number }) {
  const [data, setData] = useState<Request[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState(received ? 'EN_ATTENTE' : 'ALL');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/group-memberships${received ? '/received' : ''}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(value => { setData(value); setError(''); }).catch(e => { if (!c.signal.aborted) setError(message(e)); });
    return () => c.abort();
  }, [attempt, received]);
  const visible = data?.filter(r => (spaceId === undefined || r.spaceId === spaceId) && (filter === 'ALL' || r.status === filter));
  return <section aria-label={received ? 'Demandes d’adhésion reçues' : 'Mes demandes et adhésions'}><div className="account-section-heading"><h2>{received ? 'Demandes d’adhésion reçues' : 'Mes demandes et adhésions'}</h2><button className="text-link" onClick={() => { setAttempt(n => n + 1); onChanged?.(); }}>Actualiser {received ? 'les demandes reçues' : 'mes adhésions'}</button></div>
    {!received && <p className="workspace-description">Suivez vos demandes et les adhésions effectuées ici. <a className="text-link" href="/groupes">Découvrir les groupes →</a></p>}
    <div className="account-filters" aria-label="Filtrer les adhésions">{[['ALL', 'Toutes'], ...Object.entries(labels)].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {notice && <p className="account-notice" role="status">{notice}</p>}{error && <p className="draft-error" role="alert">{error}</p>}
    {!data && !error ? <p role="status">Chargement des adhésions…</p> : visible && !visible.length ? <p className="workspace-description">{received ? 'Aucune demande dans cette catégorie.' : 'Aucune adhésion dans cette catégorie. Vos appartenances existantes sont affichées dans Mes espaces et groupes.'}</p> : <div className="workspace-grid">{visible?.map(r => <article key={`${r.id}-${r.version}`} className="workspace-card"><span className="account-status">{labels[r.status]}</span><h3>{r.groupName}</h3><p>{r.spaceName}{received ? ` · ${r.applicant}` : ''}</p>{!r.available && <p>Le groupe ou son espace n’est plus actif. Aucune nouvelle adhésion ne peut être acceptée.</p>}{r.membershipStatus === 'INDISPONIBLE' && <p>Accès suspendu ou retiré. L’acceptation passée ne réactive pas votre accès.</p>}{r.status === 'ACCEPTEE' && r.available && ['MEMBRE', 'ADMINISTRATEUR'].includes(r.membershipStatus) && <p>{received ? 'Cette personne est membre du groupe ou en assure la gestion.' : 'Vous avez accès à ce groupe dans Mes espaces et groupes.'}</p>}{r.reason && <p className="management-copy">Motif : {r.reason}</p>}{received && r.status === 'EN_ATTENTE' && r.available && <DecisionForm request={r} onDone={() => { setNotice('Décision enregistrée. Le demandeur peut consulter la réponse dans Mon espace.'); setAttempt(n => n + 1); onChanged?.(); }} />}</article>)}</div>}
  </section>;
}
