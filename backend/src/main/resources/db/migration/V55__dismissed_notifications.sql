CREATE TABLE notification_masquee (
    utilisateur_id bigint NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    source varchar(32) NOT NULL CHECK (source IN ('activity','project','workspace','group','message','group-invite')),
    notification_id bigint NOT NULL,
    date_masquage timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (utilisateur_id,source,notification_id)
);
