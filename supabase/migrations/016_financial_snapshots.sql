CREATE TABLE IF NOT EXISTS financial_snapshots (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  receita FLOAT DEFAULT 0,
  gastos FLOAT DEFAULT 0,
  saldo FLOAT DEFAULT 0,
  credito_usado FLOAT DEFAULT 0,
  credito_limite FLOAT DEFAULT 0,
  investido FLOAT DEFAULT 0,
  score_saude INT DEFAULT 0,
  gastos_por_categoria JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);
