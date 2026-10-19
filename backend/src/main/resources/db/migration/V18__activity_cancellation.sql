ALTER TABLE activite
  ADD COLUMN annulee BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN date_annulation TIMESTAMPTZ,
  ADD CONSTRAINT activite_annulation_coherente CHECK (annulee = (date_annulation IS NOT NULL));
