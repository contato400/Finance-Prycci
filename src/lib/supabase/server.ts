import { createClient } from "@supabase/supabase-js";

// Cliente Supabase para uso no servidor (API routes)
// Usa service role key para bypass de RLS quando necessário
export function createSupabaseServer() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
