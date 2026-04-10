DELETE FROM transactions
WHERE seed_key IN (
  'salary-apr',
  'freelance-apr',
  'grocery-pao-acucar',
  'ifood-apr',
  'coffee-apr',
  'uber-apr',
  'netflix-apr',
  'energy-apr',
  'pharmacy-apr',
  'rent-apr',
  'gas-apr',
  'market-fair-apr',
  'restaurant-apr',
  'internet-apr',
  'cinema-apr',
  'uber-friday-apr',
  'gym-apr',
  'park-apr',
  'salary-mar',
  'freelance-mar',
  'rent-mar',
  'expenses-mar-extra'
);

DELETE FROM installment_purchases
WHERE seed_key LIKE 'seed:%';

UPDATE bank_connections
SET account_type = 'bank_account',
    parent_bank_connection_id = NULL,
    statement_close_day = NULL,
    statement_due_day = NULL,
    updated_at = NOW()
WHERE slug = 'nubank'
  AND account_type = 'credit_card'
  AND parent_bank_connection_id IS NULL;
