import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

// Cliente Supabase singleton para uso no browser — com sessão persistente
export function createSupabaseBrowser() {
  if (_client) return _client;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error("[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas");
  }

  _client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}
