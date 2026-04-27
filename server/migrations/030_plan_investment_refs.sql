CREATE TABLE IF NOT EXISTS plan_investment_refs (
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, investment_id)
);

INSERT INTO plan_investment_refs (plan_id, investment_id)
SELECT id, goal_investment_id
FROM plans
WHERE goal_investment_id IS NOT NULL
ON CONFLICT (plan_id, investment_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_plan_investment_refs_investment
ON plan_investment_refs (investment_id, plan_id);
