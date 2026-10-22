CREATE OR REPLACE FUNCTION activite_fin_par_defaut() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.debut IS DISTINCT FROM OLD.debut AND NEW.fin IS NOT DISTINCT FROM OLD.fin THEN
    NEW.fin := NEW.debut + (OLD.fin - OLD.debut);
  END IF;
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
