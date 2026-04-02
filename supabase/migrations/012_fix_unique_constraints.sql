-- =====================================================================
-- Fix: Limpar duplicatas e garantir UNIQUE constraints
-- EXECUTAR NO SUPABASE SQL EDITOR
-- =====================================================================

-- 1. Limpar duplicatas de pluggy_items (manter o mais antigo por item_id)
-- Primeiro, reatribuir accounts que apontam para os duplicados
UPDATE accounts a
SET item_id = keeper.id
FROM (
  SELECT item_id, MIN(id) AS id FROM pluggy_items GROUP BY item_id
) keeper
WHERE a.item_id IN (
  SELECT id FROM pluggy_items WHERE id NOT IN (
    SELECT MIN(id) FROM pluggy_items GROUP BY item_id
  )
)
AND keeper.item_id = (SELECT pi.item_id FROM pluggy_items pi WHERE pi.id = a.item_id);

-- Agora deletar os duplicados
DELETE FROM pluggy_items WHERE id NOT IN (
  SELECT MIN(id) FROM pluggy_items GROUP BY item_id
);

-- 2. Garantir UNIQUE constraint em pluggy_items.item_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pluggy_items_item_id_key'
  ) THEN
    ALTER TABLE pluggy_items ADD CONSTRAINT pluggy_items_item_id_key UNIQUE (item_id);
  END IF;
END $$;

-- 3. Garantir UNIQUE constraint em accounts.pluggy_account_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_pluggy_account_id_key'
  ) THEN
    -- Limpar duplicatas de accounts primeiro
    DELETE FROM accounts WHERE id NOT IN (
      SELECT MIN(id) FROM accounts GROUP BY pluggy_account_id
    );
    ALTER TABLE accounts ADD CONSTRAINT accounts_pluggy_account_id_key UNIQUE (pluggy_account_id);
  END IF;
END $$;

-- 4. Garantir UNIQUE constraint em transactions.pluggy_transaction_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_pluggy_transaction_id_key'
  ) THEN
    DELETE FROM transactions WHERE id NOT IN (
      SELECT MIN(id) FROM transactions GROUP BY pluggy_transaction_id
    );
    ALTER TABLE transactions ADD CONSTRAINT transactions_pluggy_transaction_id_key UNIQUE (pluggy_transaction_id);
  END IF;
END $$;

-- 5. Garantir UNIQUE constraint em investments.pluggy_investment_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'investments_pluggy_investment_id_key'
  ) THEN
    DELETE FROM investments WHERE id NOT IN (
      SELECT MIN(id) FROM investments GROUP BY pluggy_investment_id
    );
    ALTER TABLE investments ADD CONSTRAINT investments_pluggy_investment_id_key UNIQUE (pluggy_investment_id);
  END IF;
END $$;

-- 6. Corrigir MeuPluggy restantes
UPDATE pluggy_items pi
SET institution_name = CASE
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND (a.name ILIKE '%nubank%' OR a.name ILIKE '%nu pagamento%')) THEN 'Nubank'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%inter%') THEN 'Banco Inter'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND (a.name ILIKE '%caixa%' OR a.name ILIKE '%sim visa%')) THEN 'Caixa Econômica Federal'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%bradesco%') THEN 'Bradesco'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND (a.name ILIKE '%itau%' OR a.name ILIKE '%itaú%')) THEN 'Itaú'
  ELSE pi.institution_name
END
WHERE pi.institution_name = 'MeuPluggy';
