-- Migration: Adiciona user_id em TODAS as tabelas + migra dados existentes
-- EXECUTAR NO SUPABASE SQL EDITOR

-- 1. Adicionar coluna user_id em todas as tabelas que precisam
ALTER TABLE pluggy_items ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE dashboard_cache ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE credit_score ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE cpf_consultations ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_pluggy_items_user_id ON pluggy_items(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_user_id ON dashboard_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_score_user_id ON credit_score(user_id);

-- 3. Unique constraint para dashboard_cache por user_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_cache_user_id_key'
  ) THEN
    ALTER TABLE dashboard_cache ADD CONSTRAINT dashboard_cache_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4. Migrar dados existentes para o usuário real
-- SUBSTITUA O UUID ABAIXO PELO SEU user_id DO SUPABASE AUTH
-- Para encontrar: SELECT id FROM auth.users LIMIT 1;
UPDATE pluggy_items SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE accounts SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE transactions SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE investments SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE dashboard_cache SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE credit_score SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE loans SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE credit_cards SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
UPDATE cpf_consultations SET user_id = '4fb88b58-5f7e-482c-bdad-19a95bce6702' WHERE user_id = 'default';
