import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Notice = { id: number; title: string; createdAt: string };

export function AccountNotifications({ onOpenBookings }: { onOpenBookings: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => fetch('/api/notifications', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then((value: Notice[]) => { if (!controller.signal.aborted) { setNotices(value); setError(''); } })
      .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger vos nouvelles.'); });
    void load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [attempt]);
  async function acknowledge(id: number) {
    setBusyId(id); setError('');
    try { await postJson(`/api/notifications/${id}/read`); setNotices(items => items.filter(item => item.id !== id)); }
    catch { setError('Impossible de marquer cette nouvelle comme lue. Réessayez.'); }
    finally { setBusyId(null); }
  }
  if (!notices.length && !error) return null;
  return <section className="account-notifications" aria-label="Mes nouvelles">
    <h2>Mes nouvelles</h2>
    {error && <p role="alert">{error} <button className="text-link" onClick={() => setAttempt(n => n + 1)}>Réessayer</button></p>}
    {notices.slice(0, 5).map(notice => <div className="account-notice" key={notice.id}>
      <p><strong>Activité annulée :</strong> {notice.title}</p>
      <div className="management-actions"><a className="text-link" href="#mes-inscriptions" onClick={onOpenBookings}>Voir mon inscription</a><button className="text-link" disabled={busyId !== null} onClick={() => acknowledge(notice.id)}>{busyId === notice.id ? 'Enregistrement…' : 'J’ai compris'}</button></div>
    </div>)}
  </section>;
}
