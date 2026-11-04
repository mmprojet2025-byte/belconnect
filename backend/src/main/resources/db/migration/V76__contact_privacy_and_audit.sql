ALTER TABLE message_contact
  ADD COLUMN date_traitement TIMESTAMPTZ,
  ADD COLUMN date_anonymisation TIMESTAMPTZ;

CREATE TABLE historique_message_contact (
 id BIGSERIAL PRIMARY KEY,
 message_id BIGINT NOT NULL REFERENCES message_contact(id) ON DELETE CASCADE,
 acteur_id BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL,
 action VARCHAR(30) NOT NULL CHECK (action IN ('STATUT_MODIFIE','ANONYMISE')),
 ancien_statut VARCHAR(20),
 nouveau_statut VARCHAR(20),
 date_action TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX historique_message_contact_message_date
  ON historique_message_contact(message_id,date_action DESC);
