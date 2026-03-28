-- FinanceOS — Migration inicial
-- Criação de todas as tabelas do sistema

-- =============================================================
-- 1. pluggy_items — Conexões com instituições financeiras via Pluggy
-- =============================================================
CREATE TABLE IF NOT EXISTS pluggy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL UNIQUE,
  institution_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPDATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pluggy_items_item_id ON pluggy_items (item_id);

-- =============================================================
-- 2. accounts — Contas bancárias (corrente, poupança, pagamento)
-- =============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES pluggy_items(id) ON DELETE CASCADE,
  pluggy_account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(15, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_item_id ON accounts (item_id);
CREATE INDEX idx_accounts_type ON accounts (type);

-- =============================================================
-- 3. transactions — Transações financeiras
-- =============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pluggy_transaction_id TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  type TEXT NOT NULL
);

CREATE INDEX idx_transactions_account_id ON transactions (account_id);
CREATE INDEX idx_transactions_date ON transactions (date);
CREATE INDEX idx_transactions_category ON transactions (category);

-- =============================================================
-- 4. credit_cards — Cartões de crédito
-- =============================================================
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last4 TEXT NOT NULL,
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  "limit" NUMERIC(15, 2) NOT NULL DEFAULT 0,
  available_limit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_cards_account_id ON credit_cards (account_id);

-- =============================================================
-- 5. investments — Investimentos
-- =============================================================
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES pluggy_items(id) ON DELETE CASCADE,
  pluggy_investment_id TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  quantity NUMERIC(15, 6) DEFAULT 0,
  value NUMERIC(15, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investments_item_id ON investments (item_id);
CREATE INDEX idx_investments_type ON investments (type);

-- =============================================================
-- 6. loans — Empréstimos e financiamentos
-- =============================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES pluggy_items(id) ON DELETE CASCADE,
  pluggy_loan_id TEXT UNIQUE,
  institution_name TEXT NOT NULL,
  name TEXT NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  installment_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_installments INTEGER NOT NULL DEFAULT 0,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(8, 4) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loans_item_id ON loans (item_id);

-- =============================================================
-- 7. insights_cache — Cache de insights gerados pela IA
-- =============================================================
CREATE TABLE IF NOT EXISTS insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_cache_type ON insights_cache (type);
CREATE INDEX idx_insights_cache_generated_at ON insights_cache (generated_at DESC);

-- =============================================================
-- 8. credit_score — Score de crédito (inserido manualmente)
-- =============================================================
CREATE TABLE IF NOT EXISTS credit_score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 1000),
  source TEXT NOT NULL DEFAULT 'Serasa',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
