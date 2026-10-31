import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { postJson } from "../lib/auth";
import type { Booking } from "../lib/reservations";

export function BookingEditor({ booking, onSaved, onClose, onBusy }: {
  booking: Booking;
  onSaved: (updated: Booking) => void;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const data = new FormData(event.currentTarget);
    locked.current = true; setBusy(true); onBusy(true); setError("");
    try {
      const updated: Booking = await postJson(`/api/bookings/${booking.id}/modify`, {
        quantity: Number(data.get("quantity")), version: booking.version,
        firstName: String(data.get("firstName")).trim(),
        lastName: String(data.get("lastName")).trim(),
        email: String(data.get("email")).trim(), phone: String(data.get("phone")).trim(),
      });
      onSaved(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Modification impossible. Réessayez.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { locked.current = false; setBusy(false); onBusy(false); }
  }
  return <form className="flow-form booking-edit-form" onSubmit={submit} aria-label={`Modifier ${booking.title}`}>
    <h4>Modifier mon inscription</h4>
    <p>{booking.amountCents != null ? "Vous pouvez corriger vos coordonnées. Le nombre de places payées reste inchangé : son ajustement avec paiement ou remboursement n’est pas encore disponible." : "Vous pouvez réserver de 1 à 4 places, selon les disponibilités. Réduire le nombre de participants libère les places retirées."}</p>
    <p>Ces coordonnées concernent cette inscription uniquement.</p>
    <fieldset disabled={busy} style={{border:0, padding:0, margin:0, minWidth:0, display:"grid", gap:12}}>
      <label>Nombre de participants<input autoFocus readOnly={booking.amountCents != null} name="quantity" type="number" min={1} max={4} step={1} required defaultValue={booking.quantity} /></label>
      <label>Prénom<input name="firstName" autoComplete="given-name" required maxLength={80} pattern=".*\S.*" defaultValue={booking.firstName} /></label>
      <label>Nom<input name="lastName" autoComplete="family-name" required maxLength={80} pattern=".*\S.*" defaultValue={booking.lastName} /></label>
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={booking.email} /></label>
      <label>Téléphone (facultatif)<input name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={booking.phone} /></label>
      {error && <p ref={errorRef} role="alert" tabIndex={-1}>{error} <a href="/connexion" onClick={(event) => { event.preventDefault(); window.location.assign("/connexion"); }}>Recharger mes inscriptions</a></p>}
      <button type="submit" className="button coral" aria-busy={busy}>{busy ? "Enregistrement…" : "Enregistrer les modifications"}</button>
      <button type="button" className="text-link" onClick={onClose}>Abandonner les modifications</button>
    </fieldset>
  </form>;
}
