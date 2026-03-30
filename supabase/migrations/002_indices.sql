-- =====================================================================
-- FinanceOS — Índices de performance
-- Executar no SQL Editor do Supabase após a migration 001
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_item_id ON accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_cards_account_id ON credit_cards(account_id);
CREATE INDEX IF NOT EXISTS idx_investments_item_id ON investments(item_id);
CREATE INDEX IF NOT EXISTS idx_loans_item_id ON loans(item_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_items_item_id ON pluggy_items(item_id);

-- Índice composto para busca de transações por conta + data (a query mais comum)
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date DESC);
