import { useEffect, useState } from 'react';
import { postJson, result } from '../lib/auth';

type Space = { id: number; name: string };
type Status = { configured: boolean; connected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Stripe est temporairement indisponible.';

export function StripeConnectSetup({ spaces }: { spaces: Space[] }) {
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(spaces.map(async space => {
      const response = await fetch(`/api/workspace/spaces/${space.id}/stripe-connect`, {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      });
      return [space.id, await result(response)] as const;
    })).then(entries => { if (!controller.signal.aborted) setStatuses(Object.fromEntries(entries)); })
      .catch(cause => { if (!controller.signal.aborted) setError(message(cause)); });
    return () => controller.abort();
  }, [spaces]);

  async function start(spaceId: number) {
    setBusy(spaceId); setError('');
    try {
      const response: { url: string } = await postJson(`/api/workspace/spaces/${spaceId}/stripe-connect/onboarding`);
      if (!response.url.startsWith('https://connect.stripe.com/')) throw new Error('Le lien Stripe est invalide.');
      window.location.assign(response.url);
    } catch (cause) { setError(message(cause)); setBusy(null); }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = Number(params.get('space'));
    if (params.get('stripe') !== 'refresh' || !spaces.some(space => space.id === requested)) return;
    window.history.replaceState(null, '', '/mon-espace#espaces');
    const timer = window.setTimeout(() => { void start(requested); }, 0);
    return () => window.clearTimeout(timer);
    // Only retry the account-link redirect once after Stripe returns an expired link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <section aria-labelledby="stripe-connect-title">
    <div className="account-section-heading"><h2 id="stripe-connect-title">Encaissements de l’espace</h2></div>
    <p className="workspace-description">Le compte Stripe de l’espace sert aux activités payantes, aux participations payantes aux projets et aux dons. Belconnect prélève 8 % avec Starter ou 5 % avec Pro sur les transactions concernées.</p>
    {error && <p className="draft-error" role="alert">{error}</p>}
    <div className="workspace-grid">{spaces.map(space => {
      const status = statuses[space.id];
      const ready = status?.chargesEnabled && status?.payoutsEnabled;
      return <article className="workspace-card" key={space.id}>
        <h3>{space.name}</h3>
        <p>{!status ? 'Vérification du compte Stripe…' : !status.configured ? 'La connexion Stripe en mode test sera bientôt disponible.' : ready ? 'Compte Stripe prêt pour les essais de paiement.' : status.connected ? 'Configuration du compte Stripe à terminer.' : 'Reliez votre compte pour préparer les encaissements.'}</p>
        {status?.configured && !ready && <button type="button" className="button outline workspace-resume" disabled={busy !== null} onClick={() => start(space.id)}>{busy === space.id ? 'Ouverture de Stripe…' : status.connected ? 'Continuer sur Stripe' : 'Connecter Stripe'}</button>}
      </article>;
    })}</div>
  </section>;
}
