CREATE TABLE like_activite (
  activite_id BIGINT NOT NULL REFERENCES activite(id) ON DELETE CASCADE,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (activite_id, utilisateur_id)
);
CREATE INDEX like_activite_utilisateur ON like_activite(utilisateur_id);
