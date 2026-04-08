ALTER TABLE bank_connections
ADD COLUMN IF NOT EXISTS account_type TEXT;

UPDATE bank_connections
SET account_type = CASE
  WHEN slug = 'nubank' THEN 'credit_card'
  ELSE 'bank_account'
END
WHERE account_type IS NULL;

ALTER TABLE bank_connections
ALTER COLUMN account_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bank_connections_account_type_check'
  ) THEN
    ALTER TABLE bank_connections
    ADD CONSTRAINT bank_connections_account_type_check
    CHECK (account_type IN ('bank_account', 'credit_card', 'cash'));
  END IF;
END $$;

INSERT INTO bank_connections (
  user_id,
  slug,
  name,
  account_type,
  connected,
  color,
  current_balance,
  sort_order
)
SELECT
  users.id,
  'caixa',
  'Caixa/Dinheiro',
  'cash',
  TRUE,
  'bg-amber-500',
  0,
  5
FROM users
WHERE NOT EXISTS (
  SELECT 1
  FROM bank_connections
  WHERE bank_connections.user_id = users.id
    AND bank_connections.slug = 'caixa'
);
