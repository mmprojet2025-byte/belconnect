ALTER TABLE signalement_message_prive
  ADD COLUMN date_traitement TIMESTAMPTZ,
  ADD COLUMN traitant_id BIGINT REFERENCES utilisateur(id);
CREATE INDEX signalement_message_prive_attente ON signalement_message_prive(id DESC) WHERE date_traitement IS NULL;
