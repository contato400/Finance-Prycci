import { createClient } from "@supabase/supabase-js";

// Cliente Supabase para uso no servidor (API routes, server components)
export function createSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseKey);
}
