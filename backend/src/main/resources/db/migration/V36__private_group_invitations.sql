ALTER TABLE groupe ADD COLUMN invitation_code UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX groupe_invitation_code_unique ON groupe(invitation_code);
