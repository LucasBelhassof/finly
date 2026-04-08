INSERT INTO categories (
  slug,
  label,
  transaction_type,
  icon,
  color,
  group_slug,
  group_label,
  group_color,
  sort_order
)
VALUES (
  'outros-despesas',
  'Outros',
  'expense',
  'Wallet',
  'text-muted-foreground',
  'outros',
  'Outros',
  'bg-muted-foreground',
  9990
)
ON CONFLICT (slug)
DO UPDATE SET
  label = EXCLUDED.label,
  transaction_type = EXCLUDED.transaction_type,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  group_slug = EXCLUDED.group_slug,
  group_label = EXCLUDED.group_label,
  group_color = EXCLUDED.group_color,
  sort_order = EXCLUDED.sort_order;
