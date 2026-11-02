CREATE TABLE login_attempt_limit (
 cle VARCHAR(80) PRIMARY KEY,
 echecs INTEGER NOT NULL DEFAULT 0,
 debut_fenetre TIMESTAMPTZ NOT NULL DEFAULT now(),
 bloque_jusqua TIMESTAMPTZ,
 derniere_activite TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX login_attempt_limit_expiry ON login_attempt_limit(derniere_activite);
