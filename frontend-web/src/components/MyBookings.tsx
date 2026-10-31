import { useActivities } from "../context/catalogStore";
import { Icon } from "./Icon";
import { useEffect, useRef, useState } from "react";
import { postJson, result } from "../lib/auth";
import type { Booking } from "../lib/reservations";
import { readDemoPayments } from "../lib/demoPayments";
type PaidAttempt = { id: number; activityId: string; title: string; startsAt: string; location: string; image: string | null; quantity: number; amountCents: number; status: string; registrationId: number | null };
export function MyBookings({ userId }: { userId: number }) {
  const activities = useActivities();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [paidAttempts, setPaidAttempts] = useState<PaidAttempt[] | null>(null);
  const [demoPayments] = useState(() => readDemoPayments(userId));
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  async function cancel(booking: Booking) {
    if (locked.current) return;
    locked.current = true; setBusyId(booking.id); setActionError("");
    try {
      await postJson(`/api/bookings/${booking.id}/cancel`);
      setBookings(items => items?.map(item => item.id === booking.id ? {...item, status: "ANNULEE"} : item) ?? null);
      setConfirmId(null);
      setNotice(`Inscription à « ${booking.title} » annulée. ${booking.quantity} place${booking.quantity > 1 ? "s libérées" : " libérée"}.${booking.amountCents != null ? " Aucun remboursement automatique n'est déclenché." : ""}`);
      window.dispatchEvent(new Event("catalog-refresh"));
      requestAnimationFrame(() => noticeRef.current?.focus());
    } catch(cause) { setActionError(cause instanceof Error ? cause.message : "Annulation impossible. Réessayez."); }
    finally { locked.current = false; setBusyId(null); }
  }
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener("bookings-refresh", refresh);
    return () => window.removeEventListener("bookings-refresh", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const request = (path: string) => fetch(path, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(result);
    Promise.all([request('/api/bookings'), request('/api/paid-activity-bookings')])
      .then(([confirmed, attempts]) => { if (!controller.signal.aborted) { setBookings(confirmed); setPaidAttempts(attempts); setError(""); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || "Impossible de charger vos inscriptions."); });
    return () => controller.abort();
  }, [attempt]);
  const group = (b: Booking) => b.status === "ANNULEE" ? "cancelled" : new Date(b.startsAt).getTime() > now ? "upcoming" : "past";
  const paymentLabel = (b: Booking) => b.amountCents == null ? "Gratuit" :
    b.paymentStatus === "REMBOURSE" ? "Remboursé intégralement" :
    b.paymentStatus === "REMBOURSEMENT_EN_COURS" ? "Remboursement en cours" :
    b.activityCancelled ? "Remboursement à vérifier" :
    `${new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(b.amountCents / 100)} payé`;
  const matchesSearch = (title: string) => title.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'));
  const visible = bookings?.filter(b => (filter === "all" || group(b) === filter) && matchesSearch(b.title));
  const unlinkedPayments = paidAttempts?.filter(payment => payment.registrationId == null) ?? [];
  const paymentGroup = (payment: PaidAttempt) => ['ECHOUE', 'EXPIRE', 'REMBOURSE'].includes(payment.status) ? 'cancelled' : new Date(payment.startsAt).getTime() > now ? 'upcoming' : 'past';
  const visiblePayments = unlinkedPayments.filter(payment => (filter === 'all' || paymentGroup(payment) === filter) && matchesSearch(payment.title));
  const demoGroup = (activityId: string) => { const activity = activities.find(a => a.id === activityId); return activity && new Date(activity.startsAt).getTime() > now ? 'upcoming' : 'past'; };
  const visibleDemos = demoPayments.filter(payment => (filter === 'all' || demoGroup(payment.activityId) === filter) && matchesSearch(activities.find(activity => activity.id === payment.activityId)?.title ?? payment.activityId));
  const count = (id: string) => (bookings?.filter(b => id === 'all' || group(b) === id).length ?? 0) + unlinkedPayments.filter(payment => id === 'all' || paymentGroup(payment) === id).length + demoPayments.filter(payment => id === 'all' || demoGroup(payment.activityId) === id).length;
  const paymentStatus = (payment: PaidAttempt) => payment.status === 'EN_ATTENTE' ? 'Paiement en attente de confirmation' : payment.status === 'PAYE' ? 'Paiement confirmé · inscription en cours de synchronisation' : payment.status === 'REMBOURSEMENT_EN_COURS' ? 'Remboursement en cours' : payment.status === 'REMBOURSE' ? 'Remboursé' : 'Paiement non abouti';
  return <section className="account-bookings" id="mes-inscriptions" aria-label="Mes inscriptions">
    <div className="account-section-heading"><h2>Mes inscriptions</h2><span>{bookings && paidAttempts ? `${count('all')} au total` : ""}</span><button className="text-link" onClick={() => setAttempt(value => value + 1)}>Actualiser</button></div>
    <div className="account-filters" role="group" aria-label="Filtrer les inscriptions">
      {[["all","Toutes"],["upcoming","À venir"],["past","Passées"],["cancelled","Annulées / échouées"]].map(([id,label]) => <button key={id} aria-pressed={filter === id} disabled={busyId !== null} onClick={() => {setFilter(id);setConfirmId(null);setActionError("");}}>{label}<span>{bookings && paidAttempts ? count(id) : "—"}</span></button>)}
    </div>
    <label className="account-participation-search">Rechercher une activité<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nom de l’activité" /></label>
    <p className={notice ? "account-notice" : "account-notice-empty"} ref={noticeRef} tabIndex={-1} role="status">{notice}</p>
    {actionError && <p role="alert">{actionError}</p>}
    {!notice && new URLSearchParams(window.location.search).get("inscription") === "confirmee" && <p className="account-notice" role="status">Votre inscription a bien été enregistrée.</p>}
    {error ? <p role="alert">{error} <button className="text-link" onClick={() => {setError(""); setAttempt(v => v + 1);}}>Réessayer</button></p> : !bookings || !paidAttempts ? <p role="status">Chargement…</p> : visible?.length === 0 && visiblePayments.length === 0 && visibleDemos.length === 0 ? <div className="account-empty"><span><Icon name="calendar" /></span><h3>{search.trim() ? "Aucun résultat pour cette recherche" : filter === "all" ? "Aucune inscription" : "Aucune inscription dans cette catégorie"}</h3><p>{search.trim() ? "Essayez un autre nom d’activité ou effacez la recherche." : filter === "all" ? "Vos inscriptions gratuites et vos paiements Stripe confirmés apparaissent ici. Les simulations payantes effectuées depuis ce navigateur sont affichées séparément, sans réservation réelle." : "Vos inscriptions apparaîtront ici au fil de vos découvertes."}</p>{!search.trim() && <a className="button navy" href="/activites">Découvrir les activités <Icon name="arrow" /></a>}</div> : <>{visible?.map(b => <article key={b.id} className={`account-booking-card ${b.status === "ANNULEE" ? "is-cancelled" : ""}`}>
      <div className="account-booking-top">
      <span className="account-booking-image" aria-hidden="true">{activities.find(a => a.id === b.activityId)?.image ? <img src={`/images/${activities.find(a => a.id === b.activityId)?.image}.jpg`} alt="" /> : <Icon name="ticket" />}</span>
      <div className="account-booking-info"><div className="account-card-meta"><span className={`account-status status-${group(b)}`}>{b.activityCancelled ? "Activité annulée" : b.status === "ANNULEE" ? "Annulée" : group(b) === "past" ? "Passée" : "Confirmée"}</span><span className="account-reference">Réf. #{b.id}</span></div>
      <h3>{b.activityCancelled ? b.title : <a href={`/activites/${b.activityId}`}>{b.title}</a>}</h3>
      <p className="account-booking-date"><Icon name="calendar" /> {new Intl.DateTimeFormat("fr-BE", {dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Brussels"}).format(new Date(b.startsAt))} · {b.location}</p>
      <p>{b.quantity} place{b.quantity > 1 ? "s" : ""} · {paymentLabel(b)} · {b.activityCancelled ? "L’organisateur a annulé cette activité" : b.status === "ANNULEE" ? "Inscription annulée" : "Inscription confirmée"}</p>
      </div></div><details className="account-booking-contact"><summary>Coordonnées de l’inscription</summary><p>Contact : {b.firstName} {b.lastName} · {b.email}{b.phone ? ` · ${b.phone}` : ""}</p>
      </details>
      {b.status === "CONFIRMEE" && new Date(b.startsAt).getTime() > now && (
        confirmId === b.id ? <div className="account-cancel-confirm" role="group" aria-label={`Annuler ${b.title}`}>
          <p>Annuler cette inscription pour {b.quantity} personne{b.quantity > 1 ? "s" : ""} ? Toutes les places de cette réservation seront libérées.{b.amountCents != null && " Aucun remboursement automatique ne sera effectué si vous annulez vous-même."}</p>
          <button className="button outline" disabled={busyId !== null} onClick={() => cancel(b)}>{busyId === b.id ? "Annulation…" : "Confirmer l’annulation"}</button>
          <button className="text-link" disabled={busyId !== null} onClick={() => {setConfirmId(null); setActionError("");}}>Garder mon inscription</button>
        </div> : <div className="booking-actions">
          <button className="text-link" disabled={busyId !== null} onClick={() => {setConfirmId(b.id); setActionError("");}}>Annuler mon inscription</button>
        </div>
      )}
      {b.status === "ANNULEE" && !b.activityCancelled && new Date(b.startsAt).getTime() > now && <p><a href={`/activites/${b.activityId}`}>Revoir l’activité pour se réinscrire</a></p>}
    </article>)}
    {visiblePayments.map(payment => <article key={`payment-${payment.id}`} className="account-booking-card">
      <div className="account-booking-top"><span className="account-booking-image" aria-hidden="true">{payment.image ? <img src={`/images/${payment.image}.jpg`} alt="" /> : <Icon name="ticket" />}</span><div className="account-booking-info"><div className="account-card-meta"><span className={`account-status ${paymentGroup(payment) === 'cancelled' ? 'status-cancelled' : ''}`}>{paymentStatus(payment)}</span><span className="account-reference">Paiement #{payment.id}</span></div><h3><a href={`/activites/${payment.activityId}`}>{payment.title}</a></h3><p className="account-booking-date"><Icon name="calendar" /> {new Intl.DateTimeFormat('fr-BE', {dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Brussels'}).format(new Date(payment.startsAt))} · {payment.location}</p><p>{payment.quantity} place{payment.quantity > 1 ? 's' : ''} · {new Intl.NumberFormat('fr-BE', {style:'currency', currency:'EUR'}).format(payment.amountCents / 100)}</p></div></div>
      {payment.status === 'EN_ATTENTE' && <p>La place n’est pas encore confirmée. Actualisez après la confirmation Stripe.</p>}
      {['ECHOUE', 'EXPIRE'].includes(payment.status) && <p>Cette tentative n’a réservé aucune place. <a href={`/activites/${payment.activityId}`}>Revoir l’activité</a></p>}
    </article>)}
    {visibleDemos.map((payment, index) => { const activity = activities.find(a => a.id === payment.activityId); return <article key={`demo-${payment.completedAt}-${index}`} className="account-booking-card">
      <div className="account-booking-top"><span className="account-booking-image" aria-hidden="true">{activity?.image ? <img src={`/images/${activity.image}.jpg`} alt="" /> : <Icon name="ticket" />}</span><div className="account-booking-info"><div className="account-card-meta"><span className="account-status status-cancelled">Simulation · aucune réservation</span></div><h3><a href={`/activites/${payment.activityId}`}>{activity?.title ?? payment.activityId}</a></h3><p>{payment.quantity} personne{payment.quantity > 1 ? 's' : ''} · {new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(payment.amountCents / 100)} simulés</p><p>Aucun paiement encaissé, aucune place réservée.</p></div></div>
    </article>; })}
    </>}
  </section>;
}
