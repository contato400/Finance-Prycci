import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { translateCategory } from "@/lib/categories";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Dashboard:
// - Saldos atuais → cache (instantâneo)
// - Movimentações do período → queries na tabela transactions (filtradas por data)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const start = searchParams.get("start") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = searchParams.get("end") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // 1. Saldos atuais do cache (1 query, < 50ms)
    const cacheRows = await sql`SELECT data, updated_at FROM dashboard_cache WHERE id = 1 LIMIT 1`;

    if (!cacheRows.length || !cacheRows[0].data || Object.keys(cacheRows[0].data).length === 0) {
      return NextResponse.json({
        totalBalance: 0, totalCreditUsed: 0, totalCreditLimit: 0,
        totalInvested: 0, netBalance: 0, institutions: [],
        connectedBanks: 0, periodIncome: 0, periodExpenses: 0,
        periodNet: 0, topCategories: [],
        needsSync: true,
        message: "Clique em Sincronizar para carregar seus dados.",
      });
    }

    const cached = cacheRows[0].data as Record<string, unknown>;

    // 2. Movimentações do período (queries leves, filtradas por data)
    const [incomeRow, expensesRow, categoriesRows] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total
          FROM transactions WHERE amount > 0 AND date >= ${start} AND date <= ${end}`,
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total
          FROM transactions WHERE amount < 0 AND date >= ${start} AND date <= ${end}`,
      sql`SELECT COALESCE(category, 'Sem categoria') AS category,
                 SUM(ABS(amount))::float AS total
          FROM transactions
          WHERE amount < 0 AND date >= ${start} AND date <= ${end}
          GROUP BY COALESCE(category, 'Sem categoria')
          ORDER BY total DESC LIMIT 5`,
    ]);

    const periodIncome = num(incomeRow[0]?.total);
    const periodExpenses = num(expensesRow[0]?.total);
    const periodNet = periodIncome - periodExpenses;

    const topCategories = categoriesRows.map((r) => ({
      category: translateCategory(r.category),
      total: num(r.total),
    }));

    return NextResponse.json({
      // Saldos atuais (do cache — não mudam com período)
      ...cached,
      // Movimentações do período selecionado
      periodIncome,
      periodExpenses,
      periodNet,
      topCategories,
      periodStart: start,
      periodEnd: end,
      cachedAt: cacheRows[0].updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
