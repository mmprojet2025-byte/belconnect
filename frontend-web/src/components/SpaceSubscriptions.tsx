import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Space = { id: number; name: string };
type Subscription = { plan: 'STARTER' | 'PRO'; status: string; monthlyPriceCents: number; periodEnd: string | null; testCheckoutReady: boolean };
type UpgradeRequest = { spaceId: number; status: 'EN_ATTENTE' | 'PRISE_EN_CHARGE' };
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Le statut de l’abonnement est indisponible.';

export function SpaceUpgradeTeaser({ space }: { space: Space }) {
  const [status, setStatus] = useState<Subscription | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspace/spaces/${space.id}/subscription`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then(value => { if (!controller.signal.aborted) setStatus(value); })
      .catch(() => {});
    return () => controller.abort();
  }, [space.id]);
  if (!status) return null;
  return <div className="space-upgrade-teaser">
    <p>{status.plan === 'PRO' ? 'Formule Pro active' : 'Formule Starter gratuite · Pro donne accès à plus d’espaces et de groupes.'}</p>
    {status.plan === 'STARTER' && <a className="button outline" href={`/mon-espace?espace=${space.id}&rubrique=payments#organisation`}>Passer à Pro</a>}
  </div>;
}

export function SpaceSubscriptions({ spaces }: { spaces: Space[] }) {
  const [statuses, setStatuses] = useState<Record<number, Subscription>>({});
  const [requests, setRequests] = useState<Record<number, UpgradeRequest | null>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [requestIds] = useState<Record<number, string>>(() => Object.fromEntries(spaces.map(space => [space.id, crypto.randomUUID()])));
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    Promise.all(spaces.map(async space => {
      const [subscription, request] = await Promise.all(['subscription', 'pro-request'].map(path =>
        fetch(`/api/workspace/spaces/${space.id}/${path}`, { credentials: 'same-origin', cache: 'no-store', signal: c.signal })
          .then(response => path === 'pro-request' && response.status === 404 ? null : result(response))));
      return [space.id, subscription as Subscription, request as UpgradeRequest | null] as const;
    })).then(entries => { if (!c.signal.aborted) { setStatuses(Object.fromEntries(entries.map(([id, status]) => [id, status]))); setRequests(Object.fromEntries(entries.map(([id,, request]) => [id, request]))); } })
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
  async function requestPro(spaceId: number) {
    setBusy(spaceId); setError('');
    try {
      const request: UpgradeRequest = await postJson(`/api/workspace/spaces/${spaceId}/pro-request`, {});
      setRequests(current => ({ ...current, [spaceId]: request }));
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(null); }
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
        {status?.plan === 'STARTER' && (requests[space.id]
          ? <p role="status">Demande Pro {requests[space.id]?.status === 'PRISE_EN_CHARGE' ? 'prise en charge par Belconnect' : 'envoyée, en attente d’examen'}. Votre formule reste Starter.</p>
          : <button className="button outline" disabled={busy !== null} onClick={() => requestPro(space.id)}>{busy === space.id ? 'Envoi…' : 'Demander à passer en Pro'}</button>)}
        {status?.testCheckoutReady ? status.plan === 'PRO' || status.status === 'PAIEMENT_ECHOUE'
          ? <button className="button outline" disabled={busy !== null} onClick={() => open(space.id, 'portal')}>{busy === space.id ? 'Ouverture…' : 'Gérer sur Stripe'}</button>
          : <button className="button outline" disabled={busy !== null} onClick={() => open(space.id, 'checkout')}>{busy === space.id ? 'Ouverture…' : 'Essayer Pro à 10 € HT/mois'}</button>
          : status?.plan === 'STARTER' ? <p>Le paiement de test n’est pas configuré. Votre demande informe Belconnect, mais ne déclenche ni paiement ni activation Pro.</p> : <p>La gestion de cet accès Pro de test n’est pas reliée à Stripe.</p>}
      </article>;
    })}</div>
  </section>;
}
