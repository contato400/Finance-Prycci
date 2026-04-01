-- dashboard_cache: usar user_id como chave única em vez de id fixo
-- Permite cada usuário ter seu próprio cache

-- Adicionar constraint unique no user_id (se não existir)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_cache_user_id_key'
  ) THEN
    ALTER TABLE dashboard_cache ADD CONSTRAINT dashboard_cache_user_id_key UNIQUE (user_id);
  END IF;
END $$;
