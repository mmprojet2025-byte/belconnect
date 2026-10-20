import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { postJson, result } from '../lib/auth';

type Offer = { projectId: number; description: string; priceCents: number; capacity: number; placesLeft: number; active: boolean; paymentReady: boolean; commissionPercent: number; startsAt: string | null; venue: string | null };
type Enrollment = { id: number; projectId: number; projectTitle: string; priceCents: number; status: string };
const euro = (cents: number) => (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' });
const meeting = (value: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(value));
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Une erreur est survenue.';

export function PaidProjectParticipation({ projectId, signedIn }: { projectId: number; signedIn: boolean }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [booking, setBooking] = useState<Enrollment | null>(null);
  const [refresh, setRefresh] = useState(0);
  const returned = new URLSearchParams(window.location.search).get('participation');
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/project-paid-participations/offer/${projectId}`, { credentials: 'same-origin', cache: 'no-store', signal: c.signal })
      .then(async response => response.status === 404 ? null : result(response)).then(setOffer)
      .catch(cause => { if (!c.signal.aborted) setError(message(cause)); });
    return () => c.abort();
  }, [projectId]);
  useEffect(() => {
    if (!signedIn || !returned || !/^\d+$/.test(returned)) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let checks = 0;
    const check = () => fetch(`/api/project-paid-participations/${returned}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(result).then((value: Enrollment) => {
        if (controller.signal.aborted || value.projectId !== projectId) return;
        setBooking(value); setError('');
        if (value.status === 'EN_ATTENTE' && ++checks < 10) timer = window.setTimeout(check, 3000);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(message(cause)); });
    void check();
    return () => { controller.abort(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [projectId, returned, signedIn, refresh]);
  async function join() {
    setBusy(true); setError('');
    try {
      const checkout: { url: string } = await postJson('/api/project-paid-participations', { requestId, projectId });
      if (!checkout.url.startsWith('https://checkout.stripe.com/')) throw new Error('Lien de paiement invalide.');
      window.location.assign(checkout.url);
    } catch (cause) { setError(message(cause)); setBusy(false); }
  }
  if (!offer && !error) return null;
  return <section className="project-donation" aria-labelledby="paid-project-title">
    <h2 id="paid-project-title">Participer à ce projet</h2>
    {offer && <><p>{offer.description}</p>{offer.startsAt && offer.venue && <p><strong>Rendez-vous :</strong> {meeting(offer.startsAt)} · {offer.venue}</p>}<p><strong>{euro(offer.priceCents)}</strong> par personne · {offer.placesLeft} {offer.placesLeft > 1 ? 'places disponibles' : 'place disponible'} sur {offer.capacity}. Commission Belconnect : {offer.commissionPercent} % du prix.</p>
      {returned === 'annule' && <p role="status">Le paiement a été interrompu. La participation n'est pas confirmée.</p>}
      {booking && <p role="status">Votre participation : {booking.status === 'PAYE' ? 'confirmée' : booking.status === 'REMBOURSE' ? 'remboursée' : booking.status === 'REMBOURSEMENT_EN_COURS' ? 'remboursement en cours' : booking.status === 'EN_ATTENTE' ? 'en attente de confirmation ; vérification automatique en cours' : booking.status === 'ECHOUE' || booking.status === 'EXPIRE' ? 'paiement non abouti' : booking.status.toLowerCase()}.</p>}
      {signedIn && returned && /^\d+$/.test(returned) && (booking?.status === 'EN_ATTENTE' || error) && <button className="text-link" onClick={() => { setError(''); setRefresh(value => value + 1); }}>Revérifier la participation</button>}
      {!offer.active ? <p>Les participations sont fermées.</p> : !offer.startsAt || !offer.venue ? <p>La date et le lieu de cette action doivent être précisés avant de payer.</p> : !offer.paymentReady ? <p>Le paiement n'est pas encore ouvert ou la séance est passée.</p> : offer.placesLeft < 1 ? <p>Toutes les places sont réservées.</p> : !signedIn ? <a className="text-link" href={`/connexion?retour=${encodeURIComponent(`/projets/${projectId}`)}`}>Se connecter pour participer</a> : <button className="button coral" disabled={busy} onClick={join}>{busy ? 'Ouverture du paiement…' : `Participer pour ${euro(offer.priceCents)}`}</button>}</>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function PaidProjectOfferEditor({ projectId }: { projectId: number }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/project-paid-participations/manage/${projectId}`, { credentials: 'same-origin', cache: 'no-store', signal: c.signal })
      .then(async response => response.status === 404 ? null : result(response))
      .then(value => { if (value) { setOffer(value); setDescription(value.description); setPrice(String(value.priceCents / 100)); setCapacity(String(value.capacity)); setStartsAt(value.startsAt ? new Date(value.startsAt).toLocaleString('sv-SE', { timeZone: 'Europe/Brussels' }).slice(0,16).replace(' ', 'T') : ''); setVenue(value.venue ?? ''); } })
      .catch(cause => { if (!c.signal.aborted) setError(message(cause)); });
    return () => c.abort();
  }, [projectId]);
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    const normalized = price.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) { setError('Indiquez un prix valide.'); return; }
    const [euros, cents = ''] = normalized.split('.');
    const priceCents = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
    if (!Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) { setError('Prix entre 1 € et 100 000 €.'); return; }
    setBusy(true);
    try {
      const token = await result(await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' }));
      const response = await fetch(`/api/project-paid-participations/manage/${projectId}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', [token.headerName]: token.token }, body: JSON.stringify({ description, priceCents, capacity: Number(capacity), startsAt, venue }) });
      const value: Offer = await result(response); setOffer(value); setNotice('Offre enregistrée.');
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!window.confirm('Fermer les participations et rembourser intégralement chaque personne ayant payé ?')) return;
    setBusy(true); setError(''); setNotice('');
    try { const value: Offer = await postJson(`/api/project-paid-participations/manage/${projectId}/cancel`, {}); setOffer(value); setNotice('Participations fermées. Vérifiez que tous les remboursements sont terminés.'); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }
  return <div className="project-donation"><h4>Participation payante</h4><p>Une place par paiement. Commission Belconnect : {offer ? `${offer.commissionPercent} %` : "8 % en Starter, 5 % en Pro"}.</p>
    {offer && <p>{offer.active ? `${offer.placesLeft} place(s) encore disponible(s).` : 'Offre fermée.'} {offer.paymentReady ? '' : 'Paiement indisponible : vérifiez la date, le lieu et le compte Stripe.'}</p>}
    <form onSubmit={save}><label>Ce que comprend la participation <textarea value={description} onChange={e => setDescription(e.target.value)} minLength={10} maxLength={500} required /></label><label>Date et heure de la séance <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required /></label><label>Lieu de rendez-vous <input value={venue} onChange={e => setVenue(e.target.value)} minLength={5} maxLength={240} required /></label><label>Prix en euros <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} required /></label><label>Nombre de places <input type="number" min="1" max="100000" value={capacity} onChange={e => setCapacity(e.target.value)} required /></label><button className="button outline" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer l’offre'}</button></form>
    {offer && <button className="text-link" disabled={busy} onClick={cancel}>{offer.active ? 'Annuler l’offre et rembourser les participants' : 'Vérifier les remboursements'}</button>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </div>;
}

export function MyPaidProjectParticipations() {
  const [items, setItems] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/project-paid-participations', { credentials: 'same-origin', cache: 'no-store', signal: c.signal })
      .then(result).then(setItems).catch(cause => { if (!c.signal.aborted) setError(message(cause)); });
    return () => c.abort();
  }, []);
  return <section aria-labelledby="paid-participations-title"><h2 id="paid-participations-title">Mes participations aux projets</h2>
    {error && <p role="alert">{error}</p>}{items === null && !error && <p role="status">Chargement…</p>}
    {items?.length === 0 && <p>Aucune participation payante pour le moment.</p>}
    {items?.map(item => <article className="workspace-card" key={item.id}><h3><a href={`/projets/${item.projectId}`}>{item.projectTitle}</a></h3><p>{euro(item.priceCents)} · {item.status === 'PAYE' ? 'Confirmée' : item.status === 'REMBOURSE' ? 'Remboursée' : item.status === 'EN_ATTENTE' ? 'Paiement en attente' : item.status === 'REMBOURSEMENT_EN_COURS' ? 'Remboursement en cours' : item.status}</p></article>)}
  </section>;
}
