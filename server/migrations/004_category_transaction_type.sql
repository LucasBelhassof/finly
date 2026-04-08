ALTER TABLE categories
ADD COLUMN IF NOT EXISTS transaction_type TEXT;

UPDATE categories
SET transaction_type = CASE
  WHEN slug IN ('salario', 'freelance') THEN 'income'
  ELSE 'expense'
END
WHERE transaction_type IS NULL;

ALTER TABLE categories
ALTER COLUMN transaction_type SET NOT NULL;

ALTER TABLE categories
ADD CONSTRAINT categories_transaction_type_check
CHECK (transaction_type IN ('income', 'expense'));
