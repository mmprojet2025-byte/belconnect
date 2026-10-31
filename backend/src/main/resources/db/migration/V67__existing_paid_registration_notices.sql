-- Make already-confirmed paid registrations visible in the member's history too.
INSERT INTO notification_activite(utilisateur_id,inscription_id,activite_id,evenement,date_creation)
SELECT r.utilisateur_id,r.inscription_id,r.activite_id,'PAIEMENT_CONFIRME',COALESCE(r.date_paiement,r.date_creation)
FROM reservation_payante_activite r JOIN inscription_activite i ON i.id=r.inscription_id
WHERE r.statut='PAYE' AND i.statut='CONFIRMEE'
ON CONFLICT (inscription_id,utilisateur_id,evenement) DO NOTHING;
