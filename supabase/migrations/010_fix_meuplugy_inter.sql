-- Fix: item MeuPluggy que é na verdade Banco Inter
UPDATE pluggy_items
SET institution_name = 'Banco Inter'
WHERE item_id = 'e1e53abb-9a5f-49fc-86f1-e428cbc08a76'
  AND institution_name = 'MeuPluggy';

-- Fix genérico: atualizar qualquer MeuPluggy restante baseado nos nomes das contas
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
