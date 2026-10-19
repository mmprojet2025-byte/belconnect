import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Donation = { id: number; projectId: number; projectTitle: string; amountCents: number; status: string; createdAt: string };
const labels: Record<string, string> = { EN_ATTENTE: 'En attente', PAYE: 'Confirmé', ECHOUE: 'Échoué', EXPIRE: 'Expiré', REMBOURSE: 'Remboursé' };

export function MyDonations() {
  const [items, setItems] = useState<Donation[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/project-donations', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then(value => { if (!controller.signal.aborted) { setItems(value); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Dons indisponibles.'); });
    return () => controller.abort();
  }, [attempt]);
  if (items?.length === 0 && !error) return null;
  return <section aria-labelledby="my-donations-title">
    <div className="account-section-heading"><h2 id="my-donations-title">Mes soutiens financiers</h2><button className="text-link" onClick={() => setAttempt(value => value + 1)}>Actualiser</button></div>
    {error && <p role="alert">{error}</p>}
    {!items && !error && <p role="status">Chargement de vos soutiens…</p>}
    {items && <div className="workspace-grid">{items.map(item => <article className="workspace-card" key={item.id}>
      <span className="account-status">{labels[item.status] ?? item.status}</span>
      <h3><a href={`/projets/${item.projectId}`}>{item.projectTitle}</a></h3>
      <p>{(item.amountCents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })} · {new Date(item.createdAt).toLocaleDateString('fr-BE')}</p>
      {item.status === 'EN_ATTENTE' && <p>La confirmation dépend de Stripe ; actualisez pour vérifier.</p>}
    </article>)}</div>}
  </section>;
}
