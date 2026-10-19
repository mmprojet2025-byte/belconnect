import { useEffect, useState } from "react";
import { result } from "../lib/auth";

type Payment = { id: number; activityId: string; quantity: number; amountCents: number; status: string };

export function PaidActivityReturn({ userId }: { userId: number }) {
  const raw = new URLSearchParams(window.location.search).get("paiementActivite");
  const id = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (id === null) return;
    let stopped = false;
    let attempts = 0;
    let timer: number | undefined;
    async function check() {
      try {
        const value: Payment = await result(await fetch(`/api/paid-activity-bookings/${id}`, {
          credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000),
        }));
        if (stopped) return;
        setPayment(value); setError("");
        if (value.status !== "EN_ATTENTE") {
          window.sessionStorage.removeItem(`belconnect-paid-activity-${userId}-${value.activityId}-${value.quantity}`);
          window.dispatchEvent(new Event("catalog-refresh"));
          window.dispatchEvent(new Event("bookings-refresh"));
        } else if (++attempts < 10) timer = window.setTimeout(check, 3000);
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : "État du paiement indisponible.");
      }
    }
    void check();
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [id, refresh, userId]);
  if (id === null) return null;
  const message = payment?.status === "PAYE" ? "Paiement confirmé. Votre inscription figure ci-dessous."
    : payment?.status === "REMBOURSE" ? "Cette activité a été annulée et votre paiement a été remboursé."
    : payment?.status === "REMBOURSEMENT_EN_COURS" ? "Le remboursement est en cours chez Stripe."
    : payment?.status === "EXPIRE" || payment?.status === "ECHOUE" ? "Le paiement n'a pas abouti. Aucune inscription n'a été confirmée."
    : "Nous attendons la confirmation de Stripe. Votre inscription n'est pas encore confirmée.";
  return <div className="account-notice" role="status">
    <p>{error || message}</p>
    {payment?.status === "EN_ATTENTE" || error ? <button className="text-link" onClick={() => { setError(""); setRefresh(value => value + 1); }}>Revérifier le paiement</button> : null}
  </div>;
}
