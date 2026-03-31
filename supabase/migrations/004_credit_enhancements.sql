-- =====================================================================
-- FinanceOS — Migration 004: Melhorias na tela de Crédito
-- Executar no SQL Editor do Supabase
-- =====================================================================

-- Adicionar coluna recorded_at na credit_score (se não existir)
ALTER TABLE credit_score ADD COLUMN IF NOT EXISTS recorded_at DATE DEFAULT CURRENT_DATE;

-- Tabela de consultas ao CPF
CREATE TABLE IF NOT EXISTS cpf_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  institution TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Consulta de crédito',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cpf_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON cpf_consultations FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cpf_consultations_date ON cpf_consultations(consulted_at DESC);
