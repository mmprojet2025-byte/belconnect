ALTER TABLE inscription_gratuite_projet
  DROP CONSTRAINT inscription_gratuite_projet_projet_id_fkey;

ALTER TABLE inscription_gratuite_projet
  ADD CONSTRAINT inscription_gratuite_projet_projet_id_fkey
  FOREIGN KEY (projet_id) REFERENCES projet(id);
