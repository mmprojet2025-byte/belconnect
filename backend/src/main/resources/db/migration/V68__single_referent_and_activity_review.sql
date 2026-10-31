CREATE UNIQUE INDEX one_active_referent_per_group ON appartenance_groupe(groupe_id) WHERE role='REFERENT' AND statut='ACTIF';
ALTER TABLE activite ADD COLUMN publication_demandee BOOLEAN NOT NULL DEFAULT false;
