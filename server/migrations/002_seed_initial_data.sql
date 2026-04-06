INSERT INTO users (name)
SELECT 'Joao'
WHERE NOT EXISTS (
  SELECT 1
  FROM users
);

INSERT INTO categories (
  slug,
  label,
  icon,
  color,
  group_slug,
  group_label,
  group_color,
  sort_order
)
VALUES
  ('supermercado', 'Supermercado', 'ShoppingCart', 'text-primary', 'alimentacao', 'Alimentacao', 'bg-warning', 10),
  ('cafe', 'Cafe & Lanches', 'Coffee', 'text-warning', 'alimentacao', 'Alimentacao', 'bg-warning', 20),
  ('transporte', 'Transporte', 'Car', 'text-info', 'transporte', 'Transporte', 'bg-info', 30),
  ('energia', 'Energia', 'Zap', 'text-warning', 'moradia', 'Moradia', 'bg-primary', 40),
  ('moradia', 'Moradia', 'Home', 'text-primary', 'moradia', 'Moradia', 'bg-primary', 50),
  ('restaurantes', 'Restaurantes', 'Utensils', 'text-expense', 'alimentacao', 'Alimentacao', 'bg-warning', 60),
  ('assinaturas', 'Assinaturas', 'Smartphone', 'text-info', 'outros', 'Outros', 'bg-muted-foreground', 70),
  ('saude', 'Saude', 'Heart', 'text-income', 'saude', 'Saude', 'bg-income', 80),
  ('lazer', 'Lazer', 'Sparkles', 'text-expense', 'lazer', 'Lazer', 'bg-expense', 90),
  ('salario', 'Salario', 'Wallet', 'text-income', 'receitas', 'Receitas', 'bg-income', 100),
  ('freelance', 'Freelance', 'TrendingUp', 'text-income', 'receitas', 'Receitas', 'bg-income', 110)
ON CONFLICT (slug)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  group_slug = EXCLUDED.group_slug,
  group_label = EXCLUDED.group_label,
  group_color = EXCLUDED.group_color,
  sort_order = EXCLUDED.sort_order;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
bank_rows AS (
  SELECT *
  FROM (
    VALUES
      ('nubank', 'Nubank', TRUE, 'bg-purple-500', 6200.00::NUMERIC(12, 2), 10),
      ('itau', 'Itau', TRUE, 'bg-orange-500', 6250.00::NUMERIC(12, 2), 20),
      ('bradesco', 'Bradesco', FALSE, 'bg-red-500', 0.00::NUMERIC(12, 2), 30)
  ) AS rows(slug, name, connected, color, current_balance, sort_order)
)
INSERT INTO bank_connections (
  user_id,
  slug,
  name,
  connected,
  color,
  current_balance,
  sort_order
)
SELECT
  user_row.id,
  bank_rows.slug,
  bank_rows.name,
  bank_rows.connected,
  bank_rows.color,
  bank_rows.current_balance,
  bank_rows.sort_order
FROM user_row
CROSS JOIN bank_rows
ON CONFLICT (user_id, slug)
DO UPDATE SET
  name = EXCLUDED.name,
  connected = EXCLUDED.connected,
  color = EXCLUDED.color,
  current_balance = EXCLUDED.current_balance,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
summary_rows AS (
  SELECT *
  FROM (
    VALUES
      ('2026-03-01'::DATE, 12158.20::NUMERIC(12, 2), 7800.00::NUMERIC(12, 2), 4990.00::NUMERIC(12, 2)),
      ('2026-04-01'::DATE, 12450.00::NUMERIC(12, 2), 8200.00::NUMERIC(12, 2), 4830.00::NUMERIC(12, 2))
  ) AS rows(month_start, total_balance, total_income, total_expenses)
)
INSERT INTO monthly_summaries (
  user_id,
  month_start,
  total_balance,
  total_income,
  total_expenses
)
SELECT
  user_row.id,
  summary_rows.month_start,
  summary_rows.total_balance,
  summary_rows.total_income,
  summary_rows.total_expenses
FROM user_row
CROSS JOIN summary_rows
ON CONFLICT (user_id, month_start)
DO UPDATE SET
  total_balance = EXCLUDED.total_balance,
  total_income = EXCLUDED.total_income,
  total_expenses = EXCLUDED.total_expenses;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
insight_rows AS (
  SELECT *
  FROM (
    VALUES
      ('budget-restaurants', 'Gasto acima do orcamento', 'Seus gastos com restaurantes ultrapassaram o limite mensal de R$ 500 em 23%.', 'Atencao', 'warning', 10),
      ('unused-subscriptions', 'Economia identificada', 'Voce pode economizar R$ 180/mes cancelando 2 assinaturas pouco utilizadas.', 'Oportunidade', 'success', 20),
      ('emergency-fund', 'Meta de reserva', 'Com o ritmo atual, voce atinge sua reserva de emergencia em 4 meses.', 'Meta', 'info', 30),
      ('uber-pattern', 'Padrao detectado', 'Seus gastos com Uber aumentam 40% nas sextas. Considere alternativas.', 'Padrao', 'primary', 40)
  ) AS rows(seed_key, title, description, tag, tone, sort_order)
)
INSERT INTO insights (
  user_id,
  seed_key,
  title,
  description,
  tag,
  tone,
  sort_order
)
SELECT
  user_row.id,
  insight_rows.seed_key,
  insight_rows.title,
  insight_rows.description,
  insight_rows.tag,
  insight_rows.tone,
  insight_rows.sort_order
FROM user_row
CROSS JOIN insight_rows
ON CONFLICT (user_id, seed_key)
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  tag = EXCLUDED.tag,
  tone = EXCLUDED.tone,
  sort_order = EXCLUDED.sort_order;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
chat_rows AS (
  SELECT *
  FROM (
    VALUES
      ('chat-assistant-1', 'assistant', 'Ola Joao! Analisei suas financas deste mes. Voce gastou 12% a mais em alimentacao comparado ao mes passado. Quer que eu sugira formas de economizar?'),
      ('chat-user-1', 'user', 'Sim, por favor! Quero reduzir meus gastos com delivery.'),
      ('chat-assistant-2', 'assistant', E'Otimo! Aqui vao 3 dicas:\n\n1. Cozinhe em lotes no domingo e economize cerca de R$ 400/mes.\n2. Use cupons nos apps de delivery para pedidos essenciais.\n3. Defina um limite semanal de R$ 80 para delivery.\n\nIsso pode gerar uma economia de ate R$ 600/mes.')
  ) AS rows(seed_key, role, content)
)
INSERT INTO chat_messages (
  user_id,
  seed_key,
  role,
  content
)
SELECT
  user_row.id,
  chat_rows.seed_key,
  chat_rows.role,
  chat_rows.content
FROM user_row
CROSS JOIN chat_rows
ON CONFLICT (user_id, seed_key)
DO UPDATE SET
  role = EXCLUDED.role,
  content = EXCLUDED.content;

WITH user_row AS (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
),
transaction_rows AS (
  SELECT *
  FROM (
    VALUES
      ('salary-apr', 'salario', 'itau', 'Salario', 6500.00::NUMERIC(12, 2), '2026-04-05'::DATE),
      ('freelance-apr', 'freelance', 'nubank', 'Projeto freelance', 1700.00::NUMERIC(12, 2), '2026-04-04'::DATE),
      ('grocery-pao-acucar', 'supermercado', 'nubank', 'Pao de Acucar', -342.50::NUMERIC(12, 2), '2026-04-06'::DATE),
      ('ifood-apr', 'restaurantes', 'nubank', 'iFood', -67.90::NUMERIC(12, 2), '2026-04-06'::DATE),
      ('coffee-apr', 'cafe', 'nubank', 'Starbucks', -28.00::NUMERIC(12, 2), '2026-04-05'::DATE),
      ('uber-apr', 'transporte', 'nubank', 'Uber', -23.50::NUMERIC(12, 2), '2026-04-05'::DATE),
      ('netflix-apr', 'assinaturas', 'nubank', 'Netflix', -55.90::NUMERIC(12, 2), '2026-04-03'::DATE),
      ('energy-apr', 'energia', 'itau', 'Conta de Luz', -189.00::NUMERIC(12, 2), '2026-04-02'::DATE),
      ('pharmacy-apr', 'saude', 'nubank', 'Farmacia', -45.80::NUMERIC(12, 2), '2026-04-01'::DATE),
      ('rent-apr', 'moradia', 'itau', 'Aluguel', -2200.00::NUMERIC(12, 2), '2026-04-01'::DATE),
      ('gas-apr', 'transporte', 'itau', 'Combustivel', -400.00::NUMERIC(12, 2), '2026-04-04'::DATE),
      ('market-fair-apr', 'supermercado', 'nubank', 'Feira livre', -310.00::NUMERIC(12, 2), '2026-04-03'::DATE),
      ('restaurant-apr', 'restaurantes', 'itau', 'Restaurante da semana', -310.00::NUMERIC(12, 2), '2026-04-02'::DATE),
      ('internet-apr', 'moradia', 'itau', 'Internet residencial', -120.00::NUMERIC(12, 2), '2026-04-02'::DATE),
      ('cinema-apr', 'lazer', 'nubank', 'Cinema', -220.00::NUMERIC(12, 2), '2026-04-03'::DATE),
      ('uber-friday-apr', 'transporte', 'nubank', 'Uber sexta', -137.50::NUMERIC(12, 2), '2026-04-04'::DATE),
      ('gym-apr', 'saude', 'itau', 'Academia', -89.90::NUMERIC(12, 2), '2026-04-02'::DATE),
      ('park-apr', 'lazer', 'nubank', 'Passeio de fim de semana', -290.00::NUMERIC(12, 2), '2026-04-01'::DATE),
      ('salary-mar', 'salario', 'itau', 'Salario marco', 6200.00::NUMERIC(12, 2), '2026-03-05'::DATE),
      ('freelance-mar', 'freelance', 'nubank', 'Freelance marco', 1600.00::NUMERIC(12, 2), '2026-03-11'::DATE),
      ('rent-mar', 'moradia', 'itau', 'Aluguel marco', -2200.00::NUMERIC(12, 2), '2026-03-01'::DATE),
      ('expenses-mar-extra', 'restaurantes', 'nubank', 'Despesas variaveis marco', -2790.00::NUMERIC(12, 2), '2026-03-20'::DATE)
  ) AS rows(seed_key, category_slug, bank_slug, description, amount, occurred_on)
),
resolved_transactions AS (
  SELECT
    user_row.id AS user_id,
    transaction_rows.seed_key,
    categories.id AS category_id,
    bank_connections.id AS bank_connection_id,
    transaction_rows.description,
    transaction_rows.amount,
    transaction_rows.occurred_on
  FROM user_row
  CROSS JOIN transaction_rows
  INNER JOIN categories
    ON categories.slug = transaction_rows.category_slug
  LEFT JOIN bank_connections
    ON bank_connections.user_id = user_row.id
   AND bank_connections.slug = transaction_rows.bank_slug
)
INSERT INTO transactions (
  user_id,
  seed_key,
  category_id,
  bank_connection_id,
  description,
  amount,
  occurred_on
)
SELECT
  resolved_transactions.user_id,
  resolved_transactions.seed_key,
  resolved_transactions.category_id,
  resolved_transactions.bank_connection_id,
  resolved_transactions.description,
  resolved_transactions.amount,
  resolved_transactions.occurred_on
FROM resolved_transactions
ON CONFLICT (user_id, seed_key)
DO UPDATE SET
  category_id = EXCLUDED.category_id,
  bank_connection_id = EXCLUDED.bank_connection_id,
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  occurred_on = EXCLUDED.occurred_on;
