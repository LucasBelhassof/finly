DO $$
DECLARE
  legacy_demo_user_id INTEGER;
BEGIN
  SELECT u.id
  INTO legacy_demo_user_id
  FROM users u
  WHERE LOWER(u.name) = 'joao'
    AND u.email IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM auth_sessions s
      WHERE s.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM bank_connections b
      WHERE b.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM transactions t
      WHERE t.user_id = u.id
    )
    AND EXISTS (
      SELECT 1
      FROM monthly_summaries ms
      WHERE ms.user_id = u.id
        AND ms.month_start = DATE '2026-03-01'
        AND ms.total_balance = 12158.20
        AND ms.total_income = 7800.00
        AND ms.total_expenses = 4990.00
    )
    AND EXISTS (
      SELECT 1
      FROM monthly_summaries ms
      WHERE ms.user_id = u.id
        AND ms.month_start = DATE '2026-04-01'
        AND ms.total_balance = 12450.00
        AND ms.total_income = 8200.00
        AND ms.total_expenses = 4830.00
    )
    AND EXISTS (
      SELECT 1
      FROM insights i
      WHERE i.user_id = u.id
        AND i.seed_key = 'budget-restaurants'
    )
    AND EXISTS (
      SELECT 1
      FROM chat_messages m
      WHERE m.user_id = u.id
        AND m.seed_key = 'chat-assistant-1'
    )
  LIMIT 1;

  IF legacy_demo_user_id IS NOT NULL THEN
    DELETE FROM users
    WHERE id = legacy_demo_user_id;
  END IF;
END $$;
