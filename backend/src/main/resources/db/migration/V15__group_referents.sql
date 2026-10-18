ALTER TABLE groupe ADD COLUMN referents_gerent_adhesions BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE appartenance_groupe ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE historique_gestion_espace ADD COLUMN cible_utilisateur_id BIGINT REFERENCES utilisateur(id);
