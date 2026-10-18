ALTER TABLE validation_projet ADD COLUMN version_projet BIGINT;
CREATE UNIQUE INDEX validation_projet_version_unique ON validation_projet(projet_id, version_projet);
