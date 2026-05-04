ALTER TABLE categories
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE categories
DROP CONSTRAINT IF EXISTS categories_slug_key;

CREATE TEMP TABLE category_user_map (
  old_category_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  new_category_id INTEGER NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE custom_category_owners AS
SELECT DISTINCT old_category_id, user_id
FROM (
  SELECT t.category_id AS old_category_id, t.user_id
  FROM transactions t
  INNER JOIN categories c ON c.id = t.category_id
  WHERE c.is_system = FALSE

  UNION

  SELECT h.category_id AS old_category_id, h.user_id
  FROM housing h
  INNER JOIN categories c ON c.id = h.category_id
  WHERE h.category_id IS NOT NULL
    AND c.is_system = FALSE

  UNION

  SELECT ip.category_id AS old_category_id, ip.user_id
  FROM installment_purchases ip
  INNER JOIN categories c ON c.id = ip.category_id
  WHERE ip.category_id IS NOT NULL
    AND c.is_system = FALSE

  UNION

  SELECT r.category_id AS old_category_id, r.user_id
  FROM transaction_categorization_rules r
  INNER JOIN categories c ON c.id = r.category_id
  WHERE c.is_system = FALSE

  UNION

  SELECT category_id AS old_category_id, p.user_id
  FROM plans p
  CROSS JOIN LATERAL unnest(COALESCE(p.goal_category_ids, '{}'::INTEGER[])) AS category_id
  INNER JOIN categories c ON c.id = category_id
  WHERE c.is_system = FALSE

  UNION

  SELECT DISTINCT value.item::INTEGER AS old_category_id, pad.user_id
  FROM plan_ai_drafts pad
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(pad.draft #> '{goal,categoryIds}', '[]'::jsonb)) AS value(item)
  INNER JOIN categories c ON c.id = value.item::INTEGER
  WHERE value.item ~ '^[0-9]+$'
    AND c.is_system = FALSE

  UNION

  SELECT DISTINCT value.item::INTEGER AS old_category_id, pad.user_id
  FROM plan_ai_drafts pad
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(pad.draft #> '{goal,category_ids}', '[]'::jsonb)) AS value(item)
  INNER JOIN categories c ON c.id = value.item::INTEGER
  WHERE value.item ~ '^[0-9]+$'
    AND c.is_system = FALSE

  UNION

  SELECT DISTINCT value.item::INTEGER AS old_category_id, pr.user_id
  FROM plan_recommendations pr
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(pr.proposed_plan #> '{goal,categoryIds}', '[]'::jsonb)) AS value(item)
  INNER JOIN categories c ON c.id = value.item::INTEGER
  WHERE value.item ~ '^[0-9]+$'
    AND c.is_system = FALSE

  UNION

  SELECT DISTINCT value.item::INTEGER AS old_category_id, pr.user_id
  FROM plan_recommendations pr
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(pr.proposed_plan #> '{goal,category_ids}', '[]'::jsonb)) AS value(item)
  INNER JOIN categories c ON c.id = value.item::INTEGER
  WHERE value.item ~ '^[0-9]+$'
    AND c.is_system = FALSE
) AS owners;

DO $$
DECLARE
  total_users INTEGER;
  unresolved_referenced_orphan_slugs TEXT;
BEGIN
  SELECT COUNT(*)::INTEGER INTO total_users FROM users;

  IF total_users > 1 THEN
    INSERT INTO custom_category_owners (old_category_id, user_id)
    SELECT c.id, u.id
    FROM categories c
    CROSS JOIN users u
    LEFT JOIN custom_category_owners owners ON owners.old_category_id = c.id
    WHERE c.is_system = FALSE
      AND owners.old_category_id IS NULL;

    SELECT string_agg(c.slug, ', ' ORDER BY c.slug)
    INTO unresolved_referenced_orphan_slugs
    FROM categories c
    LEFT JOIN custom_category_owners owners
      ON owners.old_category_id = c.id
    WHERE c.is_system = FALSE
      AND owners.old_category_id IS NULL;

    IF unresolved_referenced_orphan_slugs IS NOT NULL THEN
      RAISE EXCEPTION 'Custom categories without inferable owner: %', unresolved_referenced_orphan_slugs;
    END IF;
  ELSIF total_users = 1 THEN
    INSERT INTO custom_category_owners (old_category_id, user_id)
    SELECT c.id, u.id
    FROM categories c
    CROSS JOIN users u
    LEFT JOIN custom_category_owners owners ON owners.old_category_id = c.id
    WHERE c.is_system = FALSE
      AND owners.old_category_id IS NULL;
  ELSE
    RAISE EXCEPTION 'At least one user row is required before scoping categories by user.';
  END IF;
END $$;

WITH system_source AS (
  SELECT
    c.id AS old_category_id,
    u.id AS user_id,
    c.slug,
    c.label,
    c.transaction_type,
    c.icon,
    c.color,
    c.group_slug,
    c.group_label,
    c.group_color,
    c.sort_order,
    c.is_system
  FROM categories c
  CROSS JOIN users u
  WHERE c.is_system = TRUE
),
inserted AS (
  INSERT INTO categories (
    user_id,
    slug,
    label,
    transaction_type,
    icon,
    color,
    group_slug,
    group_label,
    group_color,
    sort_order,
    is_system
  )
  SELECT
    user_id,
    slug,
    label,
    transaction_type,
    icon,
    color,
    group_slug,
    group_label,
    group_color,
    sort_order,
    is_system
  FROM system_source
  RETURNING id, user_id, slug
)
INSERT INTO category_user_map (old_category_id, user_id, new_category_id)
SELECT source.old_category_id, source.user_id, inserted.id
FROM system_source source
INNER JOIN inserted
  ON inserted.user_id = source.user_id
 AND inserted.slug = source.slug;

WITH custom_source AS (
  SELECT
    c.id AS old_category_id,
    owners.user_id,
    c.slug,
    c.label,
    c.transaction_type,
    c.icon,
    c.color,
    c.group_slug,
    c.group_label,
    c.group_color,
    c.sort_order,
    c.is_system
  FROM categories c
  INNER JOIN custom_category_owners owners ON owners.old_category_id = c.id
  WHERE c.is_system = FALSE
),
inserted AS (
  INSERT INTO categories (
    user_id,
    slug,
    label,
    transaction_type,
    icon,
    color,
    group_slug,
    group_label,
    group_color,
    sort_order,
    is_system
  )
  SELECT
    user_id,
    slug,
    label,
    transaction_type,
    icon,
    color,
    group_slug,
    group_label,
    group_color,
    sort_order,
    is_system
  FROM custom_source
  RETURNING id, user_id, slug
)
INSERT INTO category_user_map (old_category_id, user_id, new_category_id)
SELECT source.old_category_id, source.user_id, inserted.id
FROM custom_source source
INNER JOIN inserted
  ON inserted.user_id = source.user_id
 AND inserted.slug = source.slug;

UPDATE transactions t
SET category_id = map.new_category_id
FROM category_user_map map
WHERE map.old_category_id = t.category_id
  AND map.user_id = t.user_id;

UPDATE housing h
SET category_id = map.new_category_id
FROM category_user_map map
WHERE h.category_id IS NOT NULL
  AND map.old_category_id = h.category_id
  AND map.user_id = h.user_id;

UPDATE installment_purchases ip
SET category_id = map.new_category_id
FROM category_user_map map
WHERE ip.category_id IS NOT NULL
  AND map.old_category_id = ip.category_id
  AND map.user_id = ip.user_id;

UPDATE transaction_categorization_rules r
SET category_id = map.new_category_id
FROM category_user_map map
WHERE map.old_category_id = r.category_id
  AND map.user_id = r.user_id;

CREATE OR REPLACE FUNCTION remap_category_ids(old_ids INTEGER[], owner_user_id INTEGER)
RETURNS INTEGER[]
LANGUAGE SQL
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT COALESCE(map.new_category_id, item.category_id)
      FROM unnest(COALESCE(old_ids, '{}'::INTEGER[])) WITH ORDINALITY AS item(category_id, ordinality)
      LEFT JOIN category_user_map map
        ON map.old_category_id = item.category_id
       AND map.user_id = owner_user_id
      ORDER BY item.ordinality
    ),
    '{}'::INTEGER[]
  );
$$;

CREATE OR REPLACE FUNCTION remap_goal_category_json(payload JSONB, owner_user_id INTEGER, key_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_value JSONB;
  remapped_ids INTEGER[];
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RETURN COALESCE(payload, '{}'::jsonb);
  END IF;

  current_value := payload #> ARRAY['goal', key_name];

  IF jsonb_typeof(current_value) <> 'array' THEN
    RETURN payload;
  END IF;

  SELECT COALESCE(
    array_agg(resolved.category_id ORDER BY resolved.ordinality) FILTER (WHERE resolved.category_id IS NOT NULL),
    '{}'::INTEGER[]
  )
  INTO remapped_ids
  FROM (
    SELECT
      entry.ordinality,
      COALESCE(
        map.new_category_id,
        CASE WHEN entry.item ~ '^[0-9]+$' THEN entry.item::INTEGER ELSE NULL END
      ) AS category_id
    FROM jsonb_array_elements_text(current_value) WITH ORDINALITY AS entry(item, ordinality)
    LEFT JOIN category_user_map map
      ON map.old_category_id = CASE WHEN entry.item ~ '^[0-9]+$' THEN entry.item::INTEGER ELSE NULL END
     AND map.user_id = owner_user_id
  ) AS resolved;

  RETURN jsonb_set(payload, ARRAY['goal', key_name], to_jsonb(remapped_ids), true);
END;
$$;

UPDATE plans p
SET goal_category_ids = remap_category_ids(p.goal_category_ids, p.user_id)
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(p.goal_category_ids, '{}'::INTEGER[])) AS category_id
  INNER JOIN category_user_map map
    ON map.old_category_id = category_id
   AND map.user_id = p.user_id
);

UPDATE plan_ai_drafts pad
SET draft = remap_goal_category_json(
  remap_goal_category_json(pad.draft, pad.user_id, 'categoryIds'),
  pad.user_id,
  'category_ids'
)
WHERE EXISTS (
  SELECT 1
  FROM category_user_map map
  WHERE map.user_id = pad.user_id
    AND (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(pad.draft #> '{goal,categoryIds}', '[]'::jsonb)) AS value(item)
        WHERE value.item ~ '^[0-9]+$'
          AND value.item::INTEGER = map.old_category_id
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(pad.draft #> '{goal,category_ids}', '[]'::jsonb)) AS value(item)
        WHERE value.item ~ '^[0-9]+$'
          AND value.item::INTEGER = map.old_category_id
      )
    )
);

UPDATE plan_recommendations pr
SET proposed_plan = remap_goal_category_json(
  remap_goal_category_json(pr.proposed_plan, pr.user_id, 'categoryIds'),
  pr.user_id,
  'category_ids'
)
WHERE EXISTS (
  SELECT 1
  FROM category_user_map map
  WHERE map.user_id = pr.user_id
    AND (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(pr.proposed_plan #> '{goal,categoryIds}', '[]'::jsonb)) AS value(item)
        WHERE value.item ~ '^[0-9]+$'
          AND value.item::INTEGER = map.old_category_id
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(pr.proposed_plan #> '{goal,category_ids}', '[]'::jsonb)) AS value(item)
        WHERE value.item ~ '^[0-9]+$'
          AND value.item::INTEGER = map.old_category_id
      )
    )
);

DELETE FROM categories
WHERE user_id IS NULL;

DROP FUNCTION remap_goal_category_json(JSONB, INTEGER, TEXT);
DROP FUNCTION remap_category_ids(INTEGER[], INTEGER);

ALTER TABLE categories
ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_slug_key
ON categories (user_id, slug);

CREATE INDEX IF NOT EXISTS idx_categories_user_sort
ON categories (user_id, sort_order ASC, label ASC, id ASC);
