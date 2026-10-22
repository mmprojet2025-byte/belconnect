INSERT INTO notification_adhesion_groupe(utilisateur_id,demande_id,evenement,date_creation)
SELECT a.utilisateur_id,d.id,'DEMANDE_RECUE',d.date_creation
FROM demande_adhesion_groupe d
JOIN appartenance_espace a ON a.espace_id=d.espace_id AND a.role='ADMINISTRATEUR' AND a.statut='ACTIF'
JOIN utilisateur u ON u.id=a.utilisateur_id AND u.statut='ACTIF'
JOIN groupe g ON g.id=d.groupe_id AND g.statut='ACTIF'
JOIN espace_organisateur e ON e.id=d.espace_id AND e.statut='ACTIF'
WHERE d.statut='EN_ATTENTE' AND a.utilisateur_id<>d.utilisateur_id
ON CONFLICT DO NOTHING;

INSERT INTO notification_adhesion_groupe(utilisateur_id,demande_id,evenement,date_creation)
SELECT d.utilisateur_id,d.id,CASE d.statut WHEN 'ACCEPTEE' THEN 'DEMANDE_ACCEPTEE' ELSE 'DEMANDE_REFUSEE' END,d.date_decision
FROM demande_adhesion_groupe d
JOIN utilisateur u ON u.id=d.utilisateur_id AND u.statut='ACTIF'
WHERE d.statut IN ('ACCEPTEE','REFUSEE') AND d.examinateur_id IS NOT NULL AND d.date_decision IS NOT NULL
ON CONFLICT DO NOTHING;
