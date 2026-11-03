ALTER TABLE owner_recovery_code
  DROP CONSTRAINT owner_recovery_code_utilisateur_id_fkey,
  ADD CONSTRAINT owner_recovery_code_utilisateur_id_fkey
    FOREIGN KEY (utilisateur_id) REFERENCES owner_second_factor(utilisateur_id) ON DELETE CASCADE;

ALTER TABLE owner_second_factor
  DROP CONSTRAINT owner_second_factor_utilisateur_id_fkey,
  ADD CONSTRAINT owner_second_factor_utilisateur_id_fkey
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE;

ALTER TABLE owner_security_event
  DROP CONSTRAINT owner_security_event_utilisateur_id_fkey,
  ADD CONSTRAINT owner_security_event_utilisateur_id_fkey
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE CASCADE;
