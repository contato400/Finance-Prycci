-- Tabela de planos de usuário
CREATE TABLE IF NOT EXISTS user_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  -- 'free' | 'pro' | 'business'
  status TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'canceled' | 'past_due'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);

-- RLS
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_plan" ON user_plans;
CREATE POLICY "users_own_plan" ON user_plans
  FOR ALL USING (auth.uid()::text = user_id);
