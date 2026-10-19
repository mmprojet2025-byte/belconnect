import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Space = { id: number; name: string };
type Subscription = { plan: 'STARTER' | 'PRO'; status: string; monthlyPriceCents: number; periodEnd: string | null; testCheckoutReady: boolean };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Le statut de l’abonnement est indisponible.';

export function SpaceSubscriptions({ spaces }: { spaces: Space[] }) {
  const [statuses, setStatuses] = useState<Record<number, Subscription>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [requestIds] = useState<Record<number, string>>(() => Object.fromEntries(spaces.map(space => [space.id, crypto.randomUUID()])));
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    Promise.all(spaces.map(async space => {
      const response = await fetch(`/api/workspace/spaces/${space.id}/subscription`, { credentials: 'same-origin', cache: 'no-store', signal: c.signal });
      return [space.id, await result(response)] as const;
    })).then(entries => { if (!c.signal.aborted) setStatuses(Object.fromEntries(entries)); })
      .catch(cause => { if (!c.signal.aborted) setError(errorText(cause)); });
    return () => c.abort();
  }, [spaces, refresh]);
  async function open(spaceId: number, action: 'checkout' | 'portal') {
    setBusy(spaceId); setError('');
    try {
      const response: { url: string } = await postJson(`/api/workspace/spaces/${spaceId}/subscription/${action}`, action === 'checkout' ? { requestId: requestIds[spaceId] } : {});
      if (!response.url.startsWith(action === 'checkout' ? 'https://checkout.stripe.com/' : 'https://billing.stripe.com/')) throw new Error('Lien Stripe invalide.');
      window.location.assign(response.url);
    } catch (cause) { setError(errorText(cause)); setBusy(null); }
  }
  return <section aria-labelledby="space-subscriptions-title">
    <div className="account-section-heading"><h2 id="space-subscriptions-title">Abonnement des espaces</h2><button className="text-link" onClick={() => setRefresh(n => n + 1)}>Actualiser</button></div>
    <p className="workspace-description">Starter est gratuit. Pro est proposé à 10 € HT par mois au lancement ; la commission est de 8 % avec Starter et de 5 % avec Pro sur les transactions. Le paiement est encore en mode test.</p>
    {error && <p role="alert">{error}</p>}
    <div className="workspace-grid">{spaces.map(space => {
      const status = statuses[space.id];
      return <article className="workspace-card" key={space.id}><h3>{space.name}</h3>
        <p>{!status ? 'Chargement…' : status.plan === 'PRO' ? 'Formule Pro active' : 'Formule Starter gratuite'}{status?.status === 'PAIEMENT_ECHOUE' && ' · Paiement à régulariser'}{status?.status === 'EN_ATTENTE' && ' · Paiement en attente de confirmation'}</p>
        {status?.periodEnd && <p>Fin de période connue : {new Date(status.periodEnd).toLocaleDateString('fr-BE')}.</p>}
        {status?.testCheckoutReady ? status.plan === 'PRO' || status.status === 'PAIEMENT_ECHOUE'
          ? <button className="button outline" disabled={busy !== null} onClick={() => open(space.id, 'portal')}>{busy === space.id ? 'Ouverture…' : 'Gérer sur Stripe'}</button>
          : <button className="button outline" disabled={busy !== null} onClick={() => open(space.id, 'checkout')}>{busy === space.id ? 'Ouverture…' : 'Essayer Pro à 10 € HT/mois'}</button>
          : <p>La souscription Stripe test sera disponible après configuration du tarif et du webhook.</p>}
      </article>;
    })}</div>
  </section>;
}
