-- Group roles are scoped to an existing space membership, never self-assigned.
CREATE TABLE appartenance_groupe (
    utilisateur_id BIGINT NOT NULL,
    espace_id BIGINT NOT NULL,
    groupe_id BIGINT NOT NULL,
    role VARCHAR(24) NOT NULL DEFAULT 'MEMBRE',
    statut VARCHAR(24) NOT NULL DEFAULT 'ACTIF',
    PRIMARY KEY (utilisateur_id, groupe_id),
    FOREIGN KEY (utilisateur_id, espace_id) REFERENCES appartenance_espace(utilisateur_id, espace_id),
    FOREIGN KEY (groupe_id, espace_id) REFERENCES groupe(id, espace_id),
    CHECK (role IN ('MEMBRE', 'REFERENT')),
    CHECK (statut IN ('ACTIF', 'SUSPENDU', 'RETIRE'))
);
CREATE INDEX appartenance_groupe_groupe_idx ON appartenance_groupe(groupe_id);

-- No default owner: designation must be explicit, outside public registration.
CREATE TABLE role_plateforme (
    utilisateur_id BIGINT PRIMARY KEY REFERENCES utilisateur(id),
    role VARCHAR(24) NOT NULL CHECK (role = 'PROPRIETAIRE')
);
