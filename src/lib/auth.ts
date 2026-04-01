import { createSupabaseServer } from "@/lib/supabase/server";

// Retorna o user autenticado a partir do header Authorization (API routes)
export async function getAuthUser(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) return user;
  }
  return null;
}

// Helper para API routes: extrai user_id ou retorna null
export async function getUserId(request: Request): Promise<string | null> {
  const user = await getAuthUser(request);
  return user?.id ?? null;
}
