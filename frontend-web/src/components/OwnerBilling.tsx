import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Subscription = { spaceId: number; spaceName: string; spaceStatus: string; administrator: string; plan: string; status: string; periodEnd: string | null; stripeLinked: boolean };
type Bill = { id: string; number: string | null; spaceName: string; status: string; amountDueCents: number; amountPaidCents: number; currency: string; createdAt: number; hostedUrl: string | null; pdfUrl: string | null };
type Bills = { items: Bill[]; nextCursor: string | null; stripeConfigured: boolean };
type UpgradeRequest = { spaceId: number; spaceName: string; applicant: string; status: 'EN_ATTENTE' | 'PRISE_EN_CHARGE'; createdAt: string };
const euro = (cents: number, currency = 'eur') => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const invoiceStatus: Record<string, string> = { paid: 'Payée', open: 'À payer', draft: 'Brouillon', void: 'Annulée', uncollectible: 'Irrécouvrable' };
const subscriptionStatus: Record<string, string> = { ACTIF: 'Actif', EN_ATTENTE: 'En attente', PAIEMENT_ECHOUE: 'Paiement échoué', ANNULE: 'Annulé', GRATUIT: 'Gratuit' };

export function OwnerBilling() {
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace/owner/subscriptions', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((plans: Subscription[]) => { if (!controller.signal.aborted) setSubscriptions(plans); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les abonnements sont indisponibles.'); });
    fetch('/api/workspace/owner/pro-requests', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((items: UpgradeRequest[]) => { if (!controller.signal.aborted) setRequests(items); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les demandes Pro sont indisponibles.'); });
    fetch('/api/workspace/owner/invoices', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((invoices: Bills) => {
        if (!controller.signal.aborted) { setBills(invoices.items); setCursor(invoices.nextCursor); setConfigured(invoices.stripeConfigured); }
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les factures Stripe sont indisponibles.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [refresh]);

  async function more() {
    if (!cursor) return;
    setBusy(true); setError('');
    try {
      const page: Bills = await fetch(`/api/workspace/owner/invoices?cursor=${encodeURIComponent(cursor)}`, { credentials: 'same-origin', cache: 'no-store' }).then(result);
      setBills(current => [...current, ...page.items]); setCursor(page.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Les factures suivantes sont indisponibles.'); }
    finally { setBusy(false); }
  }
  async function take(spaceId: number) {
    setError('');
    try {
      const updated: UpgradeRequest = await postJson(`/api/workspace/owner/pro-requests/${spaceId}/take`, {});
      setRequests(current => current.map(item => item.spaceId === spaceId ? updated : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de prendre en charge la demande.'); }
  }

  return <div className="workspace-panel owner-billing">
    <div className="account-section-heading"><h2>Abonnements et factures</h2><button className="text-link" onClick={() => { setBills([]); setCursor(null); setBusy(true); setError(''); setRefresh(value => value + 1); }}>Actualiser</button></div>
    <p className="workspace-description">Facturation Stripe en mode test. Les espaces Starter gratuits n’ont pas de facture d’abonnement.</p>
    {error && <p role="alert">{error}</p>}
    {busy && !subscriptions && <p role="status">Chargement…</p>}
    <h3>Demandes de passage en Pro</h3>
    {requests.length ? <div className="workspace-grid">{requests.map(item => <article className="workspace-card" key={item.spaceId}>
      <h4>{item.spaceName}</h4><p>{item.applicant} · {item.status === 'PRISE_EN_CHARGE' ? 'Prise en charge' : 'En attente'}</p>
      <p>Demande reçue le {new Date(item.createdAt).toLocaleDateString('fr-BE')}. Une prise en charge n’active pas Pro et ne crée pas de paiement.</p>
      {item.status === 'EN_ATTENTE' && <button className="button outline" onClick={() => take(item.spaceId)}>Marquer prise en charge</button>}
    </article>)}</div> : <p>Aucune demande de passage en Pro.</p>}
    <h3>Abonnements des espaces</h3>
    {subscriptions && (subscriptions.length ? <div className="workspace-grid">{subscriptions.map(item => <article className="workspace-card" key={item.spaceId}>
      <h4>{item.spaceName}</h4><p><strong>{item.plan === 'PRO' && item.status === 'ACTIF' ? 'Pro' : 'Starter'}</strong> · {subscriptionStatus[item.status] ?? item.status}</p>
      <p>Administrateur : {item.administrator || 'Aucun abonnement engagé'}</p>
      {item.spaceStatus !== 'ACTIF' && <p>Espace : {item.spaceStatus.toLowerCase()}</p>}
      {item.periodEnd && <p>Fin de période : {new Date(item.periodEnd).toLocaleDateString('fr-BE')}</p>}
      {item.stripeLinked && <p>Compte de facturation Stripe associé</p>}
    </article>)}</div> : <p>Aucun espace organisateur.</p>)}
    <h3>Factures Stripe</h3>
    {!configured && <p>Stripe test n’est pas configuré sur ce serveur.</p>}
    {configured && !bills.length && !busy && !error && <p>Aucune facture pour le moment.</p>}
    {bills.length > 0 && <div className="workspace-grid">{bills.map(item => <article className="workspace-card" key={item.id}>
      <h4>{item.number || 'Facture en préparation'}</h4><p>{item.spaceName} · {new Date(item.createdAt * 1000).toLocaleDateString('fr-BE')}</p>
      <p>{invoiceStatus[item.status] ?? item.status} · {euro(item.amountDueCents, item.currency)} dus · {euro(item.amountPaidCents, item.currency)} payés</p>
      {item.hostedUrl?.startsWith('https://invoice.stripe.com/') && <a href={item.hostedUrl} target="_blank" rel="noopener noreferrer">Voir la facture</a>}
      {item.pdfUrl?.startsWith('https://pay.stripe.com/') && <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">Télécharger le PDF</a>}
    </article>)}</div>}
    {cursor && <button className="button outline" disabled={busy} onClick={more}>{busy ? 'Chargement…' : 'Voir les factures suivantes'}</button>}
  </div>;
}
