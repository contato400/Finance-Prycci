-- Adiciona coluna amount_profit na tabela investments para armazenar rendimento
ALTER TABLE investments ADD COLUMN IF NOT EXISTS amount_profit NUMERIC(15, 2) DEFAULT 0;
