ALTER TABLE groupe ADD COLUMN membres_souhaites INTEGER
    CHECK (membres_souhaites IS NULL OR membres_souhaites BETWEEN 1 AND 100000);
