ALTER TABLE notification_activite ADD COLUMN evenement VARCHAR(40) NOT NULL DEFAULT 'ACTIVITE_ANNULEE';
ALTER TABLE notification_activite DROP CONSTRAINT notification_activite_inscription_id_key;
ALTER TABLE notification_activite ADD CONSTRAINT notification_activite_event_unique UNIQUE(inscription_id,utilisateur_id,evenement);
