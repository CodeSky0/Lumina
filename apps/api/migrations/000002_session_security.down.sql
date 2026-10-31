ALTER TABLE refresh_tokens ALTER COLUMN token_hash TYPE CHAR(64);
ALTER TABLE users DROP COLUMN IF EXISTS token_version;
