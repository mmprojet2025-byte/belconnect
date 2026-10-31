ALTER TABLE demande_espace ADD COLUMN formule_souhaitee varchar(10) NOT NULL DEFAULT 'STARTER'
  CHECK (formule_souhaitee IN ('STARTER', 'PRO'));
