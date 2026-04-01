import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Debug: mostra userId autenticado vs user_ids no banco
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    // Verificar user_ids existentes nas tabelas
    const [piUsers, accUsers, txUsers, cacheUsers] = await Promise.all([
      sql`SELECT DISTINCT user_id FROM pluggy_items LIMIT 5`,
      sql`SELECT DISTINCT user_id FROM accounts LIMIT 5`,
      sql`SELECT DISTINCT user_id FROM transactions LIMIT 5`,
      sql`SELECT DISTINCT user_id FROM dashboard_cache LIMIT 5`,
    ]);

    return NextResponse.json({
      authenticated_user_id: userId,
      user_ids_in_db: {
        pluggy_items: piUsers.map((r) => r.user_id),
        accounts: accUsers.map((r) => r.user_id),
        transactions: txUsers.map((r) => r.user_id),
        dashboard_cache: cacheUsers.map((r) => r.user_id),
      },
      match: {
        pluggy_items: piUsers.some((r) => r.user_id === userId),
        accounts: accUsers.some((r) => r.user_id === userId),
        transactions: txUsers.some((r) => r.user_id === userId),
        dashboard_cache: cacheUsers.some((r) => r.user_id === userId),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 });
  }
}
