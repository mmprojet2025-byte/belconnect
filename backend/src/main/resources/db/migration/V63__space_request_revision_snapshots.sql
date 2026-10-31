ALTER TABLE historique_revision_demande_espace
    ADD COLUMN avant JSONB,
    ADD COLUMN apres JSONB;
