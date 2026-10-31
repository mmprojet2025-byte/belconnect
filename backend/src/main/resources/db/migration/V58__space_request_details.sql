ALTER TABLE demande_espace
    ADD COLUMN organisateur_nom varchar(180) NOT NULL DEFAULT '',
    ADD COLUMN ville varchar(120) NOT NULL DEFAULT '',
    ADD COLUMN public_vise varchar(500) NOT NULL DEFAULT '',
    ADD COLUMN programme_prevu varchar(1500) NOT NULL DEFAULT '';
