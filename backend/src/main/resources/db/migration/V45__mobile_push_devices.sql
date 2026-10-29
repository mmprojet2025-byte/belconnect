CREATE TABLE appareil_push_mobile (
    id_appareil UUID PRIMARY KEY,
    utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    jeton_expo VARCHAR(255) NOT NULL UNIQUE,
    plateforme VARCHAR(16) NOT NULL CHECK (plateforme IN ('android','ios')),
    date_creation TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_maj TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX appareil_push_mobile_utilisateur_idx ON appareil_push_mobile(utilisateur_id);
