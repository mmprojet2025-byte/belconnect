CREATE TABLE session_mobile (
    jeton_hash CHAR(64) PRIMARY KEY,
    utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    empreinte_identifiants VARCHAR(255) NOT NULL,
    date_creation TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_expiration TIMESTAMPTZ NOT NULL
);

CREATE INDEX session_mobile_utilisateur_idx ON session_mobile(utilisateur_id);
CREATE INDEX session_mobile_expiration_idx ON session_mobile(date_expiration);
