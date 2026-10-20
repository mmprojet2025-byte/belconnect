ALTER TABLE abonnement_espace ADD COLUMN termine_definitivement BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE offre_participation_projet ADD COLUMN debut_action TIMESTAMPTZ;
ALTER TABLE offre_participation_projet ADD COLUMN lieu_action VARCHAR(240);
-- Existing local offers remain readable but cannot open a new Checkout until their details are completed.
ALTER TABLE offre_participation_projet ADD CONSTRAINT offre_action_complete
  CHECK ((debut_action IS NULL AND lieu_action IS NULL)
    OR (debut_action IS NOT NULL AND length(trim(lieu_action)) BETWEEN 5 AND 240));
