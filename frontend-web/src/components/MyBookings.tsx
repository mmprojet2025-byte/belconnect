import { useActivities } from "../context/catalogStore";
import { Icon } from "./Icon";
import { useEffect, useRef, useState } from "react";
import { postJson, result } from "../lib/auth";
import type { Booking } from "../lib/reservations";
import { BookingEditor } from "./BookingEditor";
export function MyBookings() {
  const activities = useActivities();
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
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
    fetch("/api/bookings", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(result).then(data => { if (!controller.signal.aborted) setBookings(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || "Impossible de charger vos inscriptions."); });
    return () => controller.abort();
  }, [attempt]);
  const group = (b: Booking) => b.status === "ANNULEE" ? "cancelled" : new Date(b.startsAt).getTime() > now ? "upcoming" : "past";
  const paymentLabel = (b: Booking) => b.amountCents == null ? "Gratuit" :
    b.paymentStatus === "REMBOURSE" ? "Remboursé intégralement" :
    b.paymentStatus === "REMBOURSEMENT_EN_COURS" ? "Remboursement en cours" :
    b.activityCancelled ? "Remboursement à vérifier" :
    `${new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(b.amountCents / 100)} payé`;
  const visible = bookings?.filter(b => filter === "all" || group(b) === filter);
  return <section className="account-bookings" id="mes-inscriptions" aria-label="Mes inscriptions">
    <div className="account-section-heading"><h2>Mes inscriptions</h2><span>{bookings ? `${bookings.length} au total` : ""}</span></div>
    <div className="account-filters" role="group" aria-label="Filtrer les inscriptions">
      {[["all","Toutes"],["upcoming","À venir"],["past","Passées"],["cancelled","Annulées"]].map(([id,label]) => <button key={id} aria-pressed={filter === id} disabled={busyId !== null} onClick={() => {setFilter(id);setEditId(null);setConfirmId(null);setActionError("");}}>{label}<span>{bookings ? bookings.filter(b => id === "all" || group(b) === id).length : "—"}</span></button>)}
    </div>
    <p className={notice ? "account-notice" : "account-notice-empty"} ref={noticeRef} tabIndex={-1} role="status">{notice}</p>
    {actionError && <p role="alert">{actionError}</p>}
    {!notice && new URLSearchParams(window.location.search).get("inscription") === "confirmee" && <p className="account-notice" role="status">Votre inscription a bien été enregistrée.</p>}
    {error ? <p role="alert">{error} <button className="text-link" onClick={() => {setError(""); setAttempt(v => v + 1);}}>Réessayer</button></p> : !bookings ? <p role="status">Chargement…</p> : visible?.length === 0 ? <div className="account-empty"><span><Icon name="calendar" /></span><h3>{filter === "all" ? "Votre prochaine sortie vous attend" : "Aucune inscription dans cette catégorie"}</h3><p>{filter === "all" ? "Un atelier créatif ou une balade au grand air ? Trouvez une activité qui vous ressemble." : "Vos inscriptions apparaîtront ici au fil de vos découvertes."}</p><a className="button navy" href="/activites">Découvrir les activités <Icon name="arrow" /></a></div> : visible?.map(b => <article key={b.id} className={`account-booking-card ${b.status === "ANNULEE" ? "is-cancelled" : ""}`}>
      <div className="account-booking-top">
      <span className="account-booking-image" aria-hidden="true">{activities.find(a => a.id === b.activityId)?.image ? <img src={`/images/${activities.find(a => a.id === b.activityId)?.image}.jpg`} alt="" /> : <Icon name="ticket" />}</span>
      <div className="account-booking-info"><div className="account-card-meta"><span className={`account-status status-${group(b)}`}>{b.activityCancelled ? "Activité annulée" : b.status === "ANNULEE" ? "Annulée" : group(b) === "past" ? "Passée" : "Confirmée"}</span><span className="account-reference">Réf. #{b.id}</span></div>
      <h3>{b.activityCancelled ? b.title : <a href={`/activites/${b.activityId}`}>{b.title}</a>}</h3>
      <p className="account-booking-date"><Icon name="calendar" /> {new Intl.DateTimeFormat("fr-BE", {dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Brussels"}).format(new Date(b.startsAt))} · {b.location}</p>
      <p>{b.quantity} place{b.quantity > 1 ? "s" : ""} · {paymentLabel(b)} · {b.activityCancelled ? "L’organisateur a annulé cette activité" : b.status === "ANNULEE" ? "Inscription annulée" : "Inscription confirmée"}</p>
      </div></div><details className="account-booking-contact"><summary>Coordonnées de l’inscription</summary><p>Contact : {b.firstName} {b.lastName} · {b.email}{b.phone ? ` · ${b.phone}` : ""}</p>
      </details>
      {b.status === "CONFIRMEE" && new Date(b.startsAt).getTime() > now && (
        editId === b.id ? <BookingEditor key={`${b.id}-${b.version}`} booking={b}
          onBusy={busy => setBusyId(busy ? b.id : null)}
          onClose={() => setEditId(null)}
          onSaved={updated => {
            setBookings(items => items?.map(item => item.id === updated.id ? updated : item) ?? null);
            setEditId(null); setNotice("Votre inscription a été mise à jour.");
            window.dispatchEvent(new Event("catalog-refresh"));
            requestAnimationFrame(() => noticeRef.current?.focus());
          }} /> : confirmId === b.id ? <div className="account-cancel-confirm" role="group" aria-label={`Annuler ${b.title}`}>
          <p>Annuler cette inscription pour {b.quantity} personne{b.quantity > 1 ? "s" : ""} ? Toutes les places de cette réservation seront libérées.{b.amountCents != null && " Aucun remboursement automatique ne sera effectué si vous annulez vous-même."}</p>
          <button className="button outline" disabled={busyId !== null} onClick={() => cancel(b)}>{busyId === b.id ? "Annulation…" : "Confirmer l’annulation"}</button>
          <button className="text-link" disabled={busyId !== null} onClick={() => {setConfirmId(null); setActionError("");}}>Garder mon inscription</button>
        </div> : <div className="booking-actions">
          {b.amountCents == null && <button className="text-link" disabled={busyId !== null} onClick={() => {setEditId(b.id); setConfirmId(null); setActionError("");}}>Modifier mon inscription</button>}
          <button className="text-link" disabled={busyId !== null} onClick={() => {setConfirmId(b.id); setEditId(null); setActionError("");}}>Annuler mon inscription</button>
        </div>
      )}
      {b.status === "ANNULEE" && !b.activityCancelled && new Date(b.startsAt).getTime() > now && <p><a href={`/activites/${b.activityId}`}>Revoir l’activité pour se réinscrire</a></p>}
    </article>)}
  </section>;
}
