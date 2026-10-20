import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';
import { SpaceAdministrators } from './SpaceAdministrators';

type Space = { id: number; name: string; status: string; reason: string; administrators: number };
type Entry = { id: number; spaceId: number; activityId: number | null; projectId: number | null; action: string; reason: string; at: string };
type Content = { id: number; title: string; type: 'ACTIVITE' | 'PROJET'; hidden: boolean };
type Overview = { spaces: Space[]; recent: Entry[] };
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Opération impossible.';

export function OwnerModeration() {
  const [data, setData] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace/owner/moderation', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then(setData).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (selected === null) return;
    const controller = new AbortController();
    fetch(`/api/workspace/owner/moderation/spaces/${selected}/content`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then(setContents).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [selected, refresh]);
  async function act(path: string, description: string) {
    if (!window.confirm(description)) return;
    setBusy(true); setError('');
    try { await postJson(`/api/workspace/owner/moderation${path}`, { reason: reason.trim() }); setReason(''); setRefresh(n => n + 1); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  const selectedSpace = data?.spaces?.find(space => space.id === selected);
  return <section aria-labelledby="owner-moderation-title">
    <div className="account-section-heading"><h2 id="owner-moderation-title">Sécurité et modération</h2><button className="text-link" onClick={() => setRefresh(n => n + 1)}>Actualiser</button></div>
    <p className="workspace-description">Interventions ciblées, avec motif conservé. Une suspension empêche les nouvelles inscriptions et transactions ; elle ne rembourse pas automatiquement les réservations déjà payées.</p>
    {error && <p role="alert" className="draft-error">{error}</p>}
    {!data?.spaces ? <p>Chargement…</p> : <><label>Espace à examiner<select value={selected ?? ''} onChange={e => { setSelected(e.target.value ? Number(e.target.value) : null); setContents([]); }}><option value="">Choisir un espace</option>{data.spaces.map(space => <option value={space.id} key={space.id}>{space.name} · {space.status === 'ACTIF' ? 'actif' : 'suspendu'} · {space.administrators} administrateur(s)</option>)}</select></label>
      {selectedSpace && <><div className="workspace-card"><h3>{selectedSpace.name}</h3><p>Statut : {selectedSpace.status === 'ACTIF' ? 'actif' : 'suspendu'}.</p>{selectedSpace.status === 'SUSPENDU' && <p>Motif : {selectedSpace.reason}</p>}
        <label>Motif de l’intervention<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Décrivez les faits et la mesure prise" /></label>
        <div className="management-actions"><button className="button outline" disabled={busy || reason.trim().length < 10} onClick={() => act(`/spaces/${selected}/${selectedSpace.status === 'ACTIF' ? 'suspend' : 'reactivate'}`, selectedSpace.status === 'ACTIF' ? 'Suspendre cet espace et arrêter les nouvelles inscriptions ?' : 'Réactiver cet espace ?')}>{selectedSpace.status === 'ACTIF' ? 'Suspendre l’espace' : 'Réactiver l’espace'}</button></div>
        <h4>Contenus publiés</h4>{contents.length === 0 ? <p>Aucun contenu publié.</p> : contents.map(item => <div className="management-actions" key={`${item.type}-${item.id}`}><span>{item.type === 'ACTIVITE' ? 'Activité' : 'Projet'} : {item.title} {item.hidden ? '· masqué' : ''}</span><button className="text-link" disabled={busy || reason.trim().length < 10} onClick={() => act(`/spaces/${selected}/${item.type === 'ACTIVITE' ? 'activities' : 'projects'}/${item.id}/${item.hidden ? 'restore' : 'hide'}`, item.hidden ? 'Rétablir ce contenu ?' : 'Masquer ce contenu du public et bloquer les nouveaux paiements ?')}>{item.hidden ? 'Rétablir' : 'Masquer'}</button></div>)}</div>
        <SpaceAdministrators spaceId={selectedSpace.id} owner onChanged={() => setRefresh(n => n + 1)} /></>}
      {data.recent?.length > 0 && <details><summary>Historique des interventions</summary>{data.recent.map(entry => <p key={entry.id}>{new Date(entry.at).toLocaleString('fr-BE')} · Espace #{entry.spaceId} · {entry.action} · {entry.reason}</p>)}</details>}
    </>}
  </section>;
}
