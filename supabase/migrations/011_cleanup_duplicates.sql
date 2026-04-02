-- Limpar duplicatas de pluggy_items (manter o mais antigo de cada item_id)
DELETE FROM pluggy_items WHERE id NOT IN (
  SELECT MIN(id) FROM pluggy_items GROUP BY item_id
);

-- Garantir que a constraint UNIQUE existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pluggy_items_item_id_key'
  ) THEN
    ALTER TABLE pluggy_items ADD CONSTRAINT pluggy_items_item_id_key UNIQUE (item_id);
  END IF;
END $$;

-- Corrigir todos os MeuPluggy restantes baseado nos nomes das contas
UPDATE pluggy_items pi
SET institution_name = CASE
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND (a.name ILIKE '%nubank%' OR a.name ILIKE '%nu pagamento%')) THEN 'Nubank'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%inter%') THEN 'Banco Inter'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND (a.name ILIKE '%caixa%' OR a.name ILIKE '%cef%' OR a.name ILIKE '%sim visa%')) THEN 'Caixa Econômica Federal'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%bradesco%') THEN 'Bradesco'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND (a.name ILIKE '%itau%' OR a.name ILIKE '%itaú%')) THEN 'Itaú'
  WHEN EXISTS (SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%santander%') THEN 'Santander'
  ELSE pi.institution_name
END
WHERE pi.institution_name = 'MeuPluggy';
