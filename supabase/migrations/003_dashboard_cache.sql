-- =====================================================================
-- FinanceOS — Migration 003: Tabela de cache do dashboard
-- Executar no SQL Editor do Supabase
-- =====================================================================

CREATE TABLE IF NOT EXISTS dashboard_cache (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir linha padrão vazia
INSERT INTO dashboard_cache (id, data) VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE dashboard_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON dashboard_cache FOR ALL USING (true) WITH CHECK (true);
