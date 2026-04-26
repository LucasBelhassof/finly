ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_type TEXT NOT NULL DEFAULT 'items' CHECK (goal_type IN ('items', 'transaction_sum'));

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_source TEXT NOT NULL DEFAULT 'manual' CHECK (goal_source IN ('manual', 'ai'));

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_target_amount NUMERIC(12, 2);

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (goal_transaction_type IN ('income', 'expense'));

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_category_ids INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[];

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_start_date DATE;

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS goal_end_date DATE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date
ON transactions (user_id, category_id, occurred_on DESC);
