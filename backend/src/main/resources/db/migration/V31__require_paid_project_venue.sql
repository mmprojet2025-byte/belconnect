ALTER TABLE offre_participation_projet DROP CONSTRAINT offre_action_complete;
ALTER TABLE offre_participation_projet ADD CONSTRAINT offre_action_complete
  CHECK ((debut_action IS NULL AND lieu_action IS NULL)
    OR (debut_action IS NOT NULL AND lieu_action IS NOT NULL AND length(trim(lieu_action)) BETWEEN 5 AND 240));
