-- Drop legacy UNIQUE constraint on users.name to allow duplicate names
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_key;
DROP INDEX IF EXISTS users_name_key;

-- Add email_verified_at column for future email verification support
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
