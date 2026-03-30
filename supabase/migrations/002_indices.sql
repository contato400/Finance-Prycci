-- =====================================================================
-- FinanceOS — Índices de performance
-- Executar no SQL Editor do Supabase
-- =====================================================================

-- Contas
CREATE INDEX IF NOT EXISTS idx_accounts_item_id ON accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- Transações
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date DESC);

-- Cartões
CREATE INDEX IF NOT EXISTS idx_credit_cards_account_id ON credit_cards(account_id);

-- Investimentos
CREATE INDEX IF NOT EXISTS idx_investments_item_id ON investments(item_id);
CREATE INDEX IF NOT EXISTS idx_investments_item ON investments(item_id);

-- Empréstimos
CREATE INDEX IF NOT EXISTS idx_loans_item_id ON loans(item_id);

-- Pluggy Items
CREATE INDEX IF NOT EXISTS idx_pluggy_items_item_id ON pluggy_items(item_id);

-- ANALYZE para atualizar estatísticas do query planner
ANALYZE accounts;
ANALYZE transactions;
ANALYZE credit_cards;
ANALYZE investments;
ANALYZE loans;
ANALYZE pluggy_items;
