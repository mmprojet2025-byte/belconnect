ALTER TABLE espace_organisateur
    ADD COLUMN stripe_account_id VARCHAR(100),
    ADD CONSTRAINT espace_stripe_account_format CHECK (
        stripe_account_id IS NULL OR stripe_account_id ~ '^acct_[A-Za-z0-9]+$'
    );

CREATE UNIQUE INDEX espace_stripe_account_unique
    ON espace_organisateur(stripe_account_id)
    WHERE stripe_account_id IS NOT NULL;
