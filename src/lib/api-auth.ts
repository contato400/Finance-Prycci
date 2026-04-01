import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

// Helper para API routes: extrai user_id da request
// O middleware já valida o token, mas a API route precisa do user_id para queries
export async function requireAuth(request: Request): Promise<{ userId: string } | NextResponse> {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return { userId };
}
