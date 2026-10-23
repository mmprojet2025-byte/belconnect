import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Invoice = { id: string; number: string | null; status: string; amountDueCents: number; amountPaidCents: number; currency: string; createdAt: number; hostedUrl: string | null; pdfUrl: string | null };
type Page = { items: Invoice[]; nextCursor: string | null; stripeConfigured: boolean };
const euro = (cents: number, currency: string) => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const statuses: Record<string, string> = { paid: 'Payée', open: 'À payer', draft: 'Brouillon', void: 'Annulée', uncollectible: 'Irrécouvrable' };

export function SpaceInvoices({ spaceId }: { spaceId: number }) {
  const [items, setItems] = useState<Invoice[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const endpoint = `/api/workspace/spaces/${spaceId}/subscription/invoices`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((page: Page) => { if (!controller.signal.aborted) { setItems(page.items); setCursor(page.nextCursor); setConfigured(page.stripeConfigured); setLoaded(true); } })
      .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Les factures sont indisponibles.'); setLoaded(true); } });
    return () => controller.abort();
  }, [endpoint, refresh]);
  async function more() {
    if (!cursor) return;
    setBusy(true); setError('');
    try {
      const page: Page = await fetch(`${endpoint}?cursor=${encodeURIComponent(cursor)}`, { credentials: 'same-origin', cache: 'no-store' }).then(result);
      setItems(current => [...current, ...page.items]); setCursor(page.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Les factures suivantes sont indisponibles.'); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="space-invoices-title">
    <div className="account-section-heading"><h2 id="space-invoices-title">Factures de cet espace</h2><button className="text-link" onClick={() => { setLoaded(false); setItems([]); setCursor(null); setError(''); setRefresh(value => value + 1); }}>Actualiser</button></div>
    {error && <p role="alert">{error}</p>}
    {!loaded && <p role="status">Chargement des factures…</p>}
    {loaded && !configured && <p>Stripe test n’est pas configuré sur ce serveur.</p>}
    {loaded && configured && !items.length && !error && <p>Aucune facture d’abonnement pour cet espace.</p>}
    <div className="workspace-grid">{items.map(item => <article className="workspace-card" key={item.id}>
      <h3>{item.number || 'Facture en préparation'}</h3><p>{new Date(item.createdAt * 1000).toLocaleDateString('fr-BE')} · {statuses[item.status] ?? item.status}</p>
      <p>{euro(item.amountDueCents, item.currency)} dus · {euro(item.amountPaidCents, item.currency)} payés</p>
      {item.hostedUrl?.startsWith('https://invoice.stripe.com/') && <a href={item.hostedUrl} target="_blank" rel="noopener noreferrer">Voir la facture</a>}
      {item.pdfUrl?.startsWith('https://pay.stripe.com/') && <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">Télécharger le PDF</a>}
    </article>)}</div>
    {cursor && <button className="button outline" disabled={busy} onClick={more}>{busy ? 'Chargement…' : 'Voir les factures suivantes'}</button>}
  </section>;
}
