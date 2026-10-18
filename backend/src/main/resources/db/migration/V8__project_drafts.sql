ALTER TABLE projet ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE projet ADD COLUMN creation_request UUID;
CREATE UNIQUE INDEX projet_creation_request_unique ON projet(auteur_id, creation_request);
