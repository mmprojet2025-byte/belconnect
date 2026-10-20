import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Member = { id: number; name: string; email: string; role: 'MEMBRE' | 'ADMINISTRATEUR' };
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Opération impossible.';

export function SpaceAdministrators({ spaceId, owner = false, onChanged }: { spaceId: number; owner?: boolean; onChanged?: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [candidate, setCandidate] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspace/spaces/${spaceId}/administrators`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then(setMembers).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [spaceId, refresh]);
  const admins = members.filter(member => member.role === 'ADMINISTRATEUR');
  const eligible = members.filter(member => member.role === 'MEMBRE');
  async function appoint() {
    setBusy(true); setError(''); setNotice('');
    try {
      setMembers(await postJson(`/api/workspace/spaces/${spaceId}/administrators`, { memberId: Number(candidate), reason: reason.trim() }));
      setCandidate(''); setReason(''); setNotice('Le nouvel administrateur est désigné.'); onChanged?.();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function leave() {
    if (!window.confirm('Quitter le rôle d’administrateur de cet espace ? Vous resterez membre.')) return;
    setBusy(true); setError('');
    try { setMembers(await postJson(`/api/workspace/spaces/${spaceId}/administrators/leave`, {})); onChanged?.(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function recover() {
    if (!window.confirm('Confirmer la vérification de ce compte comme nouvel administrateur de l’espace ?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      setMembers(await postJson(`/api/workspace/spaces/${spaceId}/administrators/recovery`, { email: recoveryEmail.trim(), reason: reason.trim() }));
      setRecoveryEmail(''); setReason(''); setNotice('L’administration de l’espace est rétablie.'); onChanged?.();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <section className="workspace-card" aria-label="Administrateurs de l’espace">
    <h3>Administrateurs de l’espace</h3>
    <p>{admins.length ? admins.map(member => `${member.name} (${member.email})`).join(' · ') : 'Aucun administrateur actif.'}</p>
    {owner ? <p className="management-hint">La récupération est possible uniquement si l’espace n’a plus aucun administrateur actif.</p> : <p className="management-hint">Désignez un autre membre avant de quitter ce rôle.</p>}
    {(!owner || admins.length === 0) && eligible.length > 0 && <div className="draft-editor">
      <label>Membre à désigner<select value={candidate} onChange={e => setCandidate(e.target.value)}><option value="">Choisir un membre</option>{eligible.map(member => <option key={member.id} value={member.id}>{member.name} ({member.email})</option>)}</select></label>
      <label>Motif de la désignation<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button className="button outline" disabled={busy || !candidate || reason.trim().length < 10} onClick={appoint}>{busy ? 'Enregistrement…' : 'Désigner administrateur'}</button>
    </div>}
    {owner && admins.length === 0 && eligible.length === 0 && <div className="draft-editor"><p>Après vérification de l’identité et du droit de représenter l’organisateur, désignez un compte Belconnect actif.</p><label>Adresse e-mail du compte vérifié<input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} /></label><label>Motif et vérification effectuée<textarea maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="button outline" disabled={busy || !recoveryEmail.trim() || reason.trim().length < 10} onClick={recover}>Rétablir l’administration</button></div>}
    {!owner && admins.length > 1 && <button className="text-link" disabled={busy} onClick={leave}>Quitter le rôle d’administrateur</button>}
    <button className="text-link" disabled={busy} onClick={() => setRefresh(n => n + 1)}>Actualiser les administrateurs</button>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="draft-error">{error}</p>}
  </section>;
}
