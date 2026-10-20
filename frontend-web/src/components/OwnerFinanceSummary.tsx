import { useEffect, useState } from 'react';
import { result } from '../lib/auth';

type Summary = {
  activeSpaces: number;
  proSpaces: number;
  paidTransactions: number;
  confirmedCommissionCents: number;
  pendingRefunds: number;
};

const money = (cents: number) => (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });

export function OwnerFinanceSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/workspace/owner/finance', {
      credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    }).then(result).then(value => { if (!controller.signal.aborted) { setSummary(value); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Les chiffres sont indisponibles.'); });
    return () => controller.abort();
  }, [attempt]);

  return <section aria-labelledby="owner-finance-title">
    <div className="account-section-heading"><h2 id="owner-finance-title">Suivi de Belconnect</h2><button className="text-link" type="button" onClick={() => setAttempt(value => value + 1)}>Actualiser</button></div>
    <p className="workspace-description">Données locales en mode test. Les commissions ci-dessous concernent les paiements confirmés encore marqués « payés » ; les remboursements et les frais Stripe ne sont pas inclus dans un résultat comptable.</p>
    {error && <p role="alert">{error} Les derniers chiffres chargés restent affichés.</p>}
    {!summary && !error && <p role="status">Chargement du suivi…</p>}
    {summary && <div className="owner-finance-grid">
      <div className="workspace-card"><strong>{summary.activeSpaces}</strong><span>espaces actifs</span></div>
      <div className="workspace-card"><strong>{summary.proSpaces}</strong><span>abonnements Pro actifs</span></div>
      <div className="workspace-card"><strong>{summary.paidTransactions}</strong><span>paiements confirmés</span></div>
      <div className="workspace-card"><strong>{money(summary.confirmedCommissionCents)}</strong><span>commissions sur paiements confirmés</span></div>
      <div className="workspace-card"><strong>{summary.pendingRefunds}</strong><span>remboursements en cours</span></div>
    </div>}
    <p className="workspace-description">Les revenus des abonnements ne figurent pas ici : leur historique de facturation doit être rapproché avec Stripe.</p>
  </section>;
}
