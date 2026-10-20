-- Preserve the outcome of requests processed before notifications were introduced.
INSERT INTO notification_demande_espace (utilisateur_id, demande_id, evenement, date_creation)
SELECT demandeur_id, id,
       CASE statut WHEN 'APPROUVEE' THEN 'DEMANDE_APPROUVEE' ELSE 'DEMANDE_REFUSEE' END,
       COALESCE(date_decision, date_creation)
FROM demande_espace
WHERE statut IN ('APPROUVEE', 'REFUSEE')
ON CONFLICT (utilisateur_id, demande_id, evenement) DO NOTHING;

-- Pending older requests remain actionable for the platform owner.
INSERT INTO notification_demande_espace (utilisateur_id, demande_id, evenement, date_creation)
SELECT r.utilisateur_id, d.id, 'DEMANDE_RECUE', d.date_creation
FROM demande_espace d
JOIN role_plateforme r ON r.role = 'PROPRIETAIRE' AND r.utilisateur_id <> d.demandeur_id
JOIN utilisateur u ON u.id = r.utilisateur_id AND u.statut = 'ACTIF'
WHERE d.statut = 'EN_ATTENTE'
ON CONFLICT (utilisateur_id, demande_id, evenement) DO NOTHING;
