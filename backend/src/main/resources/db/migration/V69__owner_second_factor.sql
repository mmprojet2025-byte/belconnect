CREATE TABLE owner_second_factor (
 utilisateur_id BIGINT PRIMARY KEY REFERENCES utilisateur(id),
 secret_chiffre TEXT,
 active BOOLEAN NOT NULL DEFAULT false,
 dernier_pas BIGINT NOT NULL DEFAULT -1,
 echecs INTEGER NOT NULL DEFAULT 0,
 bloque_jusqua TIMESTAMPTZ,
 version BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE owner_recovery_code (
 utilisateur_id BIGINT NOT NULL REFERENCES owner_second_factor(utilisateur_id),
 empreinte VARCHAR(64) NOT NULL,
 PRIMARY KEY(utilisateur_id, empreinte)
);
CREATE TABLE owner_security_event (
 id BIGSERIAL PRIMARY KEY,
 utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id),
 evenement VARCHAR(50) NOT NULL,
 date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);
