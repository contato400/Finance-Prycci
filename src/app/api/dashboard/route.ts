import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function defaultStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}
function defaultEnd(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
}

// Dashboard: lê cache (instantâneo) + dados do período selecionado
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? defaultStart();
    const end = searchParams.get("end") ?? defaultEnd();

    // Cache instantâneo (saldos atuais, bancos, investimentos)
    const rows = await sql`SELECT data, updated_at FROM dashboard_cache WHERE id = 1 LIMIT 1`;

    if (!rows.length || !rows[0].data || Object.keys(rows[0].data).length === 0) {
      return NextResponse.json({
        totalBalance: 0, totalCreditUsed: 0, totalCreditLimit: 0,
        totalInvested: 0, netBalance: 0,
        institutions: [], balanceHistory: [],
        connectedBanks: 0, totalExpenses: 0, totalIncome: 0,
        needsSync: true,
        message: "Clique em Sincronizar para carregar seus dados.",
      });
    }

    const cached = rows[0].data as Record<string, unknown>;

    // Dados do período selecionado (query leve, agrupada)
    const [periodData] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::float AS total_expenses,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float AS total_income
      FROM transactions
      WHERE date >= ${start} AND date <= ${end}
    `;

    // Gráfico de evolução no período selecionado
    const txChart = await sql`
      SELECT date::text AS date, SUM(amount)::float AS total
      FROM transactions
      WHERE date >= ${start} AND date <= ${end}
      GROUP BY date ORDER BY date
    `;

    const totalBalance = num(cached.totalBalance);
    const txByDay = new Map<string, number>();
    for (const tx of txChart) txByDay.set(tx.date, num(tx.total));

    // Gerar dias do período
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    const balanceHistory: { date: string; balance: number }[] = [];

    for (let i = diffDays - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayDelta = txByDay.get(dateStr) || 0;
      balanceHistory.push({
        date: dateStr,
        balance: Math.round((totalBalance - dayDelta * (i / Math.max(diffDays / 3, 1))) * 100) / 100,
      });
    }

    return NextResponse.json({
      ...cached,
      balanceHistory,
      totalExpenses: num(periodData?.total_expenses),
      totalIncome: num(periodData?.total_income),
      periodStart: start,
      periodEnd: end,
      cachedAt: rows[0].updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
