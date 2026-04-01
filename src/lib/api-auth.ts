import { NextResponse } from "next/server";

// Helper para API routes: extrai user_id do header x-user-id
// O middleware já validou o token e setou o header
export async function requireAuth(request: Request): Promise<{ userId: string } | NextResponse> {
  // O middleware seta x-user-id após validar o token
  const userId = request.headers.get("x-user-id");
  if (userId) {
    return { userId };
  }

  // Fallback: tentar extrair do Authorization header diretamente
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      );
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
      if (!error && user) {
        return { userId: user.id };
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}
