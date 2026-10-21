import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';

type Group = { id: number; name: string; role: string };
type Announcement = { id: number; groupId: number; groupName: string; author: string; content: string; createdAt: string };
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Impossible de joindre le serveur.';

export function GroupAnnouncements({ groups }: { groups: Group[] }) {
  const writable = groups.filter(g => g.role === 'ADMINISTRATEUR' || g.role === 'REFERENT');
  const [items, setItems] = useState<Announcement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [groupId, setGroupId] = useState(() => writable[0]?.id ?? 0);
  const [content, setContent] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedGroup = writable.some(group => group.id === groupId) ? groupId : writable[0]?.id ?? 0;
  const visible = items.filter(item => groups.some(group => group.id === item.groupId));
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/group-announcements', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then((value: Announcement[]) => { if (!controller.signal.aborted) { setItems(value); setLoaded(true); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [attempt]);
  async function publish(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await postJson('/api/group-announcements', { requestId, groupId: selectedGroup, content });
      setContent(''); setRequestId(crypto.randomUUID()); setNotice('Annonce publiée pour les membres du groupe.'); setAttempt(n => n + 1);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="group-announcements-title">
    <div className="account-section-heading"><h2 id="group-announcements-title">Nouvelles de mes groupes</h2><button className="text-link" disabled={busy} onClick={() => setAttempt(n => n + 1)}>Actualiser</button></div>
    {writable.length > 0 && <form className="group-announcement-form workspace-card" onSubmit={publish}>
      <h3>Partager une nouvelle</h3>
      <label>Groupe<select value={selectedGroup} onChange={e => setGroupId(Number(e.target.value))}>{writable.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label>Votre annonce<textarea required maxLength={1000} value={content} onChange={e => setContent(e.target.value)} placeholder="Une rencontre, une information pratique…" /></label>
      <button className="button coral" disabled={busy || !content.trim()}>{busy ? 'Publication…' : 'Publier l’annonce'}</button>
    </form>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {error && <p className="draft-error" role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Réessayer</button></p>}
    {!loaded && !error && <p role="status">Chargement des nouvelles…</p>}
    {loaded && !visible.length && <p className="workspace-muted">Aucune annonce pour le moment.</p>}
    {visible.length > 0 && <div className="workspace-grid">{visible.map(item => <article className="workspace-card group-announcement" key={item.id}>
      <span className="account-status">{item.groupName}</span>
      <p className="group-announcement-meta">{item.author} · {new Date(item.createdAt).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short' })}</p>
      <p className="group-announcement-content">{item.content}</p>
    </article>)}</div>}
  </section>;
}
