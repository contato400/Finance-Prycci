import { NextResponse } from "next/server";

// Helper para API routes: extrai user_id do header x-user-id
// O middleware decodifica o JWT e seta x-user-id no request header
export async function requireAuth(request: Request): Promise<{ userId: string } | NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (userId) {
    return { userId };
  }

  // Fallback: decodificar JWT diretamente
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.sub) {
        return { userId: payload.sub };
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}
