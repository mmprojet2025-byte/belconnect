ALTER TABLE utilisateur ADD COLUMN date_suppression TIMESTAMPTZ;

CREATE TABLE conversation_privee_masquee (
  conversation_id BIGINT NOT NULL REFERENCES conversation_privee(id) ON DELETE CASCADE,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  dernier_message_id BIGINT NOT NULL DEFAULT 0,
  date_masquage TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, utilisateur_id)
);

ALTER TABLE appartenance_groupe ADD COLUMN date_depart_volontaire TIMESTAMPTZ;
