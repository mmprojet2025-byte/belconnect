CREATE TABLE abonnement_espace (
 espace_id BIGINT PRIMARY KEY REFERENCES espace_organisateur(id),
 administrateur_id BIGINT NOT NULL REFERENCES utilisateur(id),
 formule VARCHAR(16) NOT NULL DEFAULT 'STARTER' CHECK (formule IN ('STARTER','PRO')),
 statut VARCHAR(24) NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','ACTIF','PAIEMENT_ECHOUE','ANNULE')),
 prix_centimes INTEGER NOT NULL DEFAULT 1000 CHECK (prix_centimes BETWEEN 100 AND 1000000),
 devise VARCHAR(3) NOT NULL DEFAULT 'eur' CHECK (devise='eur'),
 client_stripe VARCHAR(255) UNIQUE,
 abonnement_stripe VARCHAR(255) UNIQUE,
 session_stripe VARCHAR(255) UNIQUE,
 demande UUID,
 fin_periode TIMESTAMPTZ,
 date_modification TIMESTAMPTZ NOT NULL DEFAULT now()
);
