ALTER TABLE inscription_activite ADD COLUMN statut VARCHAR(16) NOT NULL DEFAULT 'CONFIRMEE'
 CHECK (statut IN ('CONFIRMEE', 'ANNULEE'));
ALTER TABLE inscription_activite ADD COLUMN date_annulation TIMESTAMPTZ;
ALTER TABLE inscription_activite ADD CONSTRAINT inscription_annulation_coherente
 CHECK ((statut = 'ANNULEE') = (date_annulation IS NOT NULL));
ALTER TABLE inscription_activite DROP CONSTRAINT inscription_activite_utilisateur_id_activite_id_key;
CREATE UNIQUE INDEX inscription_active_unique ON inscription_activite(utilisateur_id, activite_id)
 WHERE statut = 'CONFIRMEE';
