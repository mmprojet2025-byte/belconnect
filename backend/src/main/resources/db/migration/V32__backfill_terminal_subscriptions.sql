UPDATE abonnement_espace
SET termine_definitivement=true
WHERE statut='ANNULE' AND abonnement_stripe IS NOT NULL;
