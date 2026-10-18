export type Review = { decision: string; comment: string; reviewer: string; date: string };
export function ReviewHistory({ reviews = [] }: { reviews?: Review[] }) {
  if (!reviews.length) return null;
  return <section className="review-history" aria-label="Historique des avis"><h4>Historique des avis</h4><ol>{reviews.map((review, index) => <li key={`${review.date}-${index}`}><strong>{review.decision === 'A_CORRIGER' ? 'Corrections demandées' : review.decision === 'AVIS_FAVORABLE' ? 'Avis favorable du référent' : review.decision === 'APPROUVE' ? 'Projet approuvé' : review.decision === 'REFUSE' ? 'Projet refusé' : review.decision}</strong><p>{review.reviewer} · {new Date(review.date).toLocaleString('fr-BE')}</p>{review.comment && <p className="review-comment">{review.comment}</p>}</li>)}</ol></section>;
}
