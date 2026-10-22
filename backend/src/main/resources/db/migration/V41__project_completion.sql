ALTER TABLE projet ADD COLUMN termine_le TIMESTAMPTZ;
CREATE INDEX projet_catalogue_actif_idx ON projet (date_publication DESC, id DESC)
  WHERE publie AND termine_le IS NULL AND statut='APPROUVE';
