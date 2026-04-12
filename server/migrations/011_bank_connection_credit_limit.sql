ALTER TABLE bank_connections
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2);
