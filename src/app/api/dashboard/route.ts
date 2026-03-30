import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const revalidate = 30;

// Dashboard: lê cache pré-calculado (1 query simples, < 50ms)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rows = await sql`SELECT data, updated_at FROM dashboard_cache WHERE id = 1`;

    if (!rows.length || !rows[0].data || Object.keys(rows[0].data).length === 0) {
      // Cache vazio — nunca sincronizou
      return NextResponse.json({
        totalBalance: 0,
        totalCreditUsed: 0,
        totalCreditLimit: 0,
        totalInvested: 0,
        netBalance: 0,
        institutions: [],
        balanceHistory: [],
        connectedBanks: 0,
        needsSync: true,
        message: "Clique em Sincronizar para carregar seus dados.",
      });
    }

    const cached = rows[0].data;
    return NextResponse.json({
      ...cached,
      cachedAt: rows[0].updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
