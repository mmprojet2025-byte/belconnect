ALTER TABLE activite ADD COLUMN fin TIMESTAMPTZ;
UPDATE activite SET fin = debut
  + (substring(duree FROM '^[0-9]+')::integer * INTERVAL '1 hour')
  + (COALESCE(substring(duree FROM ' h ([0-9]+)'), '0')::integer * INTERVAL '1 minute')
WHERE duree ~ '^[0-9]+ (h|heure)';
UPDATE activite SET fin = debut + INTERVAL '2 hours' WHERE fin IS NULL;
CREATE FUNCTION activite_fin_par_defaut() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fin IS NULL THEN
    IF NEW.duree ~ '^[0-9]+ (h|heure)' THEN
      NEW.fin := NEW.debut
        + (substring(NEW.duree FROM '^[0-9]+')::integer * INTERVAL '1 hour')
        + (COALESCE(substring(NEW.duree FROM ' h ([0-9]+)'), '0')::integer * INTERVAL '1 minute');
    ELSE
      NEW.fin := NEW.debut + INTERVAL '2 hours';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER activite_fin_legacy BEFORE INSERT OR UPDATE OF debut,duree ON activite
  FOR EACH ROW EXECUTE FUNCTION activite_fin_par_defaut();
ALTER TABLE activite ALTER COLUMN fin SET NOT NULL;
ALTER TABLE activite ADD CONSTRAINT activite_fin_apres_debut CHECK (fin > debut);
CREATE INDEX activite_espace_fin_index ON activite (espace_id, fin DESC, id DESC);
