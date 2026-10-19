import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';

type Donation = { id: number; projectId: number; projectTitle: string; amountCents: number; status: string };
const labels: Record<string, string> = { EN_ATTENTE: 'Paiement en attente de confirmation', PAYE: 'Don confirmé', ECHOUE: 'Paiement non abouti', EXPIRE: 'Session expirée', REMBOURSE: 'Don remboursé' };
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Le service de don est indisponible.';

export function ProjectDonation({ projectId, signedIn }: { projectId: number; signedIn: boolean }) {
  const [availability, setAvailability] = useState<{ available: boolean; commissionPercent: number } | null>(null);
  const [amount, setAmount] = useState('10');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [donation, setDonation] = useState<Donation | null>(null);
  const returned = new URLSearchParams(window.location.search).get('donation');
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    fetch(`/api/project-donations/availability?projectId=${projectId}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then(value => { if (!controller.signal.aborted) setAvailability(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    if (returned && /^\d+$/.test(returned)) {
      fetch(`/api/project-donations/${returned}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        .then(result).then(value => { if (!controller.signal.aborted && value.projectId === projectId) setDonation(value); })
        .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    }
    return () => controller.abort();
  }, [projectId, signedIn, returned]);
  async function send(event: FormEvent) {
    event.preventDefault(); setError('');
    const normalized = amount.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) { setError('Indiquez un montant en euros, avec deux décimales au maximum.'); return; }
    const [euros, cents = ''] = normalized.split('.');
    const amountCents = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
    if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 10_000_000) {
      setError('Choisissez un montant entre 1 € et 100 000 €.'); return;
    }
    setBusy(true);
    try {
      const checkout: { url: string } = await postJson('/api/project-donations', { requestId, projectId, amountCents });
      if (!checkout.url.startsWith('https://checkout.stripe.com/')) throw new Error('Le lien de paiement reçu est invalide.');
      window.location.assign(checkout.url);
    } catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <section className="project-donation" aria-labelledby="project-donation-title">
    <h2 id="project-donation-title">Soutenir financièrement ce projet</h2>
    <p>Choisissez librement votre montant. Ce soutien ne réserve pas de place et ne crée pas d’adhésion.</p>
    {returned === 'annule' && <p role="status">Le paiement a été interrompu. Aucun don n’est confirmé.</p>}
    {donation && <p role="status">{labels[donation.status] ?? donation.status} · {(donation.amountCents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })}. {donation.status === 'EN_ATTENTE' && 'Actualisez cette page pour vérifier sa confirmation.'}</p>}
    {!signedIn ? <p><a className="text-link" href={`/connexion?retour=${encodeURIComponent(`/projets/${projectId}`)}`}>Se connecter pour soutenir ce projet</a></p>
      : availability === null ? <p role="status">Vérification des dons…</p>
      : !availability.available ? <p>Les dons pour ce projet ne sont pas encore ouverts.</p>
      : <form onSubmit={send}>
        <label>Montant du don en euros <input value={amount} onChange={event => { setAmount(event.target.value); setRequestId(crypto.randomUUID()); }} inputMode="decimal" autoComplete="off" required aria-describedby="donation-limits" /></label>
        <small id="donation-limits">Entre 1 € et 100 000 €. Commission Belconnect : {availability.commissionPercent} % du montant.</small>
        <button className="button coral" disabled={busy}>{busy ? 'Ouverture du paiement…' : 'Continuer vers Stripe'}</button>
      </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
