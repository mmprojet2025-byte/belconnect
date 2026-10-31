ALTER TABLE utilisateur ADD COLUMN avatar_code VARCHAR(12);
ALTER TABLE utilisateur ADD CONSTRAINT utilisateur_avatar_code_check
  CHECK (avatar_code IS NULL OR avatar_code IN ('mint', 'amber', 'coral', 'blue'));
