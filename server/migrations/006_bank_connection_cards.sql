ALTER TABLE bank_connections
ADD COLUMN IF NOT EXISTS parent_bank_connection_id INTEGER REFERENCES bank_connections(id) ON DELETE SET NULL;

ALTER TABLE bank_connections
ADD COLUMN IF NOT EXISTS statement_close_day INTEGER;

ALTER TABLE bank_connections
ADD COLUMN IF NOT EXISTS statement_due_day INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bank_connections_statement_close_day_check'
  ) THEN
    ALTER TABLE bank_connections
    ADD CONSTRAINT bank_connections_statement_close_day_check
    CHECK (statement_close_day IS NULL OR statement_close_day BETWEEN 1 AND 31);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bank_connections_statement_due_day_check'
  ) THEN
    ALTER TABLE bank_connections
    ADD CONSTRAINT bank_connections_statement_due_day_check
    CHECK (statement_due_day IS NULL OR statement_due_day BETWEEN 1 AND 31);
  END IF;
END $$;

UPDATE bank_connections
SET parent_bank_connection_id = NULL
WHERE parent_bank_connection_id = id;

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_parent
ON bank_connections (user_id, parent_bank_connection_id, sort_order ASC, id ASC);
