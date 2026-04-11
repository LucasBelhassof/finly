ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE categories
SET is_system = TRUE
WHERE slug IN (
  'supermercado',
  'cafe',
  'transporte',
  'energia',
  'moradia',
  'restaurantes',
  'assinaturas',
  'saude',
  'lazer',
  'salario',
  'freelance',
  'outros-despesas',
  'compras'
);
