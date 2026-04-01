import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Migra TODOS os dados com user_id diferente do autenticado para o user atual.
// Isso corrige o mismatch quando o user_id no banco é diferente do Supabase Auth.
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const tables = [
      "pluggy_items", "accounts", "transactions", "investments",
      "dashboard_cache", "credit_score", "loans", "credit_cards", "cpf_consultations",
    ];

    const results: Record<string, number> = {};

    for (const table of tables) {
      try {
        const res = await sql.unsafe(
          `UPDATE ${table} SET user_id = $1 WHERE user_id != $1 RETURNING 1`,
          [userId]
        );
        results[table] = res.length;
      } catch {
        results[table] = -1; // tabela pode não existir
      }
    }

    return NextResponse.json({
      message: "Dados migrados para o usuário autenticado",
      userId,
      rowsUpdated: results,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 });
  }
}
