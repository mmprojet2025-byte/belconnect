import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Registration = { id: number; firstName: string; lastName: string; email: string; phone: string; quantity: number; status: string; registeredAt: string; cancelledAt: string | null };
type Register = { activityId: number; title: string; capacity: number; reserved: number; remaining: number; confirmed: number; cancelled: number; registrations: Registration[] };
const statuses = { ALL: 'Toutes', CONFIRMEE: 'Confirmées', ANNULEE: 'Annulées' };
const date = (value: string) => new Date(value).toLocaleString('fr-BE', { timeZone: 'Europe/Brussels', dateStyle: 'medium', timeStyle: 'short' });
const message = (e: unknown) => e instanceof Error ? e.message : 'Le serveur est indisponible. Réessayez.';

export function ActivityRegistrations({ activityId, onClose }: { activityId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Register | null>(null);
  const [status, setStatus] = useState<keyof typeof statuses>('ALL');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    let generation = 0;
    const load = () => {
      const current = ++generation;
      setLoading(true); setError(''); setNotice('');
      fetch(`/api/managed-activities/${activityId}/registrations?status=${status}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) })
        .then(result).then(value => { if (!abort.signal.aborted && current === generation) { setData(value); setLoading(false); } })
        .catch(e => { if (!abort.signal.aborted && current === generation) { setData(null); setLoading(false); setError(message(e)); } });
    };
    load(); window.addEventListener('focus', load);
    return () => { abort.abort(); window.removeEventListener('focus', load); };
  }, [activityId, status, attempt]);
  async function download() {
    setExporting(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/managed-activities/${activityId}/registrations.csv?status=${status}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (!response.ok) { setData(null); await result(response); return; }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `inscriptions-activite-${activityId}-${status.toLowerCase()}.csv`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Export CSV téléchargé pour le filtre « ' + statuses[status] + ' ».');
    } catch (e) { setError(message(e)); } finally { setExporting(false); }
  }
  return <section className="management-panel activity-register" aria-labelledby="activity-register-title" aria-busy={loading}>
    <div className="account-section-heading"><h3 id="activity-register-title">{data ? `Inscriptions — ${data.title}` : 'Inscriptions de l’activité'}</h3><button className="text-link" onClick={onClose}>Fermer les inscriptions</button></div>
    <p className="workspace-description">Une ligne correspond à une réservation. Les coordonnées sont celles de la personne qui a réservé ; les noms des accompagnants ne sont pas collectés. Dates en heure de Bruxelles.</p>
    <div className="management-actions"><button className="button outline" onClick={() => setAttempt(n => n + 1)} disabled={exporting || loading}>Actualiser les inscriptions</button><button className="button coral" disabled={!data || exporting || loading} onClick={download}>{exporting ? 'Export en cours…' : 'Exporter en CSV'}</button></div>
    <div className="account-filters" aria-label="Filtrer les inscriptions de l’activité">{Object.entries(statuses).map(([key, label]) => <button key={key} disabled={exporting || loading} aria-pressed={status === key} onClick={() => { if (key !== status) { setStatus(key as keyof typeof statuses); } }}>{label}</button>)}</div>
    {error && <p className="draft-error" role="alert">{error}</p>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    {!data && !error && <p role="status">Chargement des inscriptions…</p>}
    {data && <>
      <dl className="registration-totals"><div><dt>Places réservées</dt><dd>{data.reserved} / {data.capacity}</dd></div><div><dt>Places restantes</dt><dd>{data.remaining}</dd></div><div><dt>Inscriptions confirmées</dt><dd>{data.confirmed}</dd></div><div><dt>Inscriptions annulées</dt><dd>{data.cancelled}</dd></div></dl>
      <p className="management-hint">Les totaux concernent toute l’activité. L’export contient uniquement les inscriptions du filtre sélectionné, actualisées au moment du téléchargement.</p>
      {data.registrations.length ? <ul className="registration-list">{data.registrations.map(r => <li className="registration-compact-row" key={r.id}><details>
        <summary><span className="registration-person">{r.firstName} {r.lastName}</span><span>{r.quantity} place{r.quantity > 1 ? 's' : ''}</span><span className="account-status">{r.status === 'CONFIRMEE' ? 'Confirmée' : 'Annulée'}</span></summary>
        <div className="registration-expanded"><p className="management-hint">Inscription #{r.id}</p>
        <dl><div><dt>E-mail</dt><dd>{r.email}</dd></div><div><dt>Téléphone</dt><dd>{r.phone || 'Non renseigné'}</dd></div><div><dt>Inscription</dt><dd>{date(r.registeredAt)}</dd></div>{r.cancelledAt && <div><dt>Annulation</dt><dd>{date(r.cancelledAt)}</dd></div>}</dl>
        </div></details>
      </li>)}</ul> : <p className="account-empty">Aucune inscription dans cette catégorie.</p>}
    </>}
  </section>;
}
