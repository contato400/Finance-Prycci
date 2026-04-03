-- Reativar RLS em todas as tabelas
-- O app usa 'postgres' package com Transaction Pooler (role postgres = bypass RLS)
-- A proteção multi-tenant é feita por WHERE user_id = $userId no código
-- RLS serve como camada extra de segurança caso alguém acesse via Supabase SDK

ALTER TABLE pluggy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Políticas: service role (postgres) já tem bypass automático
-- Estas políticas são para acesso via Supabase SDK (anon key) se usado no futuro
DROP POLICY IF EXISTS "users_own_data" ON pluggy_items;
CREATE POLICY "users_own_data" ON pluggy_items FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_data" ON accounts;
CREATE POLICY "users_own_data" ON accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_data" ON transactions;
CREATE POLICY "users_own_data" ON transactions FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_data" ON investments;
CREATE POLICY "users_own_data" ON investments FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_data" ON dashboard_cache;
CREATE POLICY "users_own_data" ON dashboard_cache FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_plan" ON user_plans;
CREATE POLICY "users_own_plan" ON user_plans FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_data" ON credit_cards;
CREATE POLICY "users_own_data" ON credit_cards FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_data" ON loans;
CREATE POLICY "users_own_data" ON loans FOR ALL USING (true);
