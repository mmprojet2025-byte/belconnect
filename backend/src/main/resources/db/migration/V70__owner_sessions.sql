CREATE TABLE owner_web_session (
 id BIGSERIAL PRIMARY KEY,
 utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(id),
 empreinte VARCHAR(64) NOT NULL UNIQUE,
 navigateur VARCHAR(60) NOT NULL,
 appareil VARCHAR(60) NOT NULL,
 cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
 vu_le TIMESTAMPTZ NOT NULL DEFAULT now(),
 revoquee_le TIMESTAMPTZ
);
CREATE INDEX owner_web_session_user ON owner_web_session(utilisateur_id,vu_le DESC);
