-- Adiciona user_id em todas as tabelas para suporte multi-usuário
ALTER TABLE pluggy_items ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'default';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pluggy_items_user_id ON pluggy_items(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
