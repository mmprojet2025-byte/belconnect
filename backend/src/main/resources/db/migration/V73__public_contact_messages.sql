CREATE TABLE message_contact (
 id BIGSERIAL PRIMARY KEY,
 utilisateur_id BIGINT REFERENCES utilisateur(id) ON DELETE SET NULL,
 nom VARCHAR(120),
 email VARCHAR(254),
 categorie VARCHAR(20) NOT NULL CHECK (categorie IN ('AVIS','SUGGESTION','PROBLEME','QUESTION')),
 message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
 reponse_souhaitee BOOLEAN NOT NULL DEFAULT FALSE,
 consentement BOOLEAN NOT NULL,
 statut VARCHAR(20) NOT NULL DEFAULT 'NOUVEAU' CHECK (statut IN ('NOUVEAU','EN_COURS','TRAITE','ARCHIVE')),
 date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX message_contact_statut_date ON message_contact(statut,date_creation DESC);
CREATE TABLE limite_message_contact (
 cle VARCHAR(80) PRIMARY KEY,
 nombre INTEGER NOT NULL DEFAULT 0,
 debut_fenetre TIMESTAMPTZ NOT NULL DEFAULT now(),
 derniere_activite TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX limite_message_contact_expiry ON limite_message_contact(derniere_activite);
