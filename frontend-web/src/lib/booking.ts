import type { Activity } from "../data/activities";
import type { UserProfile } from "./auth";
export type EnrollmentDraft = Omit<UserProfile, "id"> & {
  phone: string;
  acknowledged: boolean;
  reviewedQuantity: number | null;
};
export function bookingQuantity(activity: Activity, search: string) {
  const raw = Number(new URLSearchParams(search).get("participants") || 1);
  return Math.min(
    Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1),
    Math.max(1, Math.min(4, activity.details.remaining)),
  );
}
export function bookingUrl(id: string, step: string, quantity: number) {
  return `/activites/${id}/${step}?participants=${quantity}`;
}
export const money = (amount: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    amount,
  );

export const paymentDraftKey = (draft: EnrollmentDraft) => JSON.stringify(draft);
