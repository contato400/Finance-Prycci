-- Row Level Security para multi-usuário
-- Cada usuário só vê/modifica seus próprios dados

-- Habilitar RLS
ALTER TABLE pluggy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Adicionar user_id onde falta
ALTER TABLE dashboard_cache ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';

-- Policies: usuário vê apenas seus dados
-- Usa auth.uid() para Supabase Auth

-- pluggy_items
DROP POLICY IF EXISTS "users_own_data" ON pluggy_items;
CREATE POLICY "users_own_data" ON pluggy_items
  FOR ALL USING (auth.uid()::text = user_id);

-- accounts
DROP POLICY IF EXISTS "users_own_data" ON accounts;
CREATE POLICY "users_own_data" ON accounts
  FOR ALL USING (auth.uid()::text = user_id);

-- transactions
DROP POLICY IF EXISTS "users_own_data" ON transactions;
CREATE POLICY "users_own_data" ON transactions
  FOR ALL USING (auth.uid()::text = user_id);

-- investments
DROP POLICY IF EXISTS "users_own_data" ON investments;
CREATE POLICY "users_own_data" ON investments
  FOR ALL USING (auth.uid()::text = user_id);

-- dashboard_cache
DROP POLICY IF EXISTS "users_own_data" ON dashboard_cache;
CREATE POLICY "users_own_data" ON dashboard_cache
  FOR ALL USING (auth.uid()::text = user_id);

-- credit_cards
DROP POLICY IF EXISTS "users_own_data" ON credit_cards;
CREATE POLICY "users_own_data" ON credit_cards
  FOR ALL USING (auth.uid()::text = user_id);

-- loans
DROP POLICY IF EXISTS "users_own_data" ON loans;
CREATE POLICY "users_own_data" ON loans
  FOR ALL USING (auth.uid()::text = user_id);

-- Service role continua com acesso total (bypass RLS automático)
-- As API routes usam service role key, então não são afetadas
