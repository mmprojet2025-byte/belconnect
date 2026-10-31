CREATE TABLE demande_passage_pro (
  espace_id BIGINT PRIMARY KEY REFERENCES espace_organisateur(id),
  demandeur_id BIGINT NOT NULL REFERENCES utilisateur(id),
  statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','PRISE_EN_CHARGE')),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_maj TIMESTAMPTZ NOT NULL DEFAULT now()
);
