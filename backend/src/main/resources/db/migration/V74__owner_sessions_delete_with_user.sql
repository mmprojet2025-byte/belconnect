ALTER TABLE owner_web_session
  DROP CONSTRAINT owner_web_session_utilisateur_id_fkey,
  ADD CONSTRAINT owner_web_session_utilisateur_id_fkey
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE;
