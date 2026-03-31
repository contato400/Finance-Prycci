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

    // Queries em paralelo
    const [
      creditAccounts, loans, scoreRows, allScores,
      periodTx, biggestTx, dailyUsage, topCategories, cpfConsultations,
    ] = await Promise.all([
      // Contas de crédito atuais
      sql`SELECT a.id, a.balance::float as balance,
                 COALESCE(a.credit_limit, 0)::float as credit_limit,
                 a.name, p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id
          WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
          ORDER BY a.updated_at DESC`,
      // Empréstimos
      sql`SELECT *, COALESCE(outstanding_balance, 0)::float as outstanding_balance
          FROM loans ORDER BY updated_at DESC`,
      // Score mais recente
      sql`SELECT * FROM credit_score ORDER BY updated_at DESC LIMIT 1`,
      // Histórico de scores no período
      sql`SELECT score, source, recorded_at::text as recorded_at, updated_at
          FROM credit_score
          WHERE recorded_at >= ${start} AND recorded_at <= ${end}
          ORDER BY recorded_at ASC`,
      // Total gasto no crédito no período
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float as total_spent,
                 COUNT(*)::int as tx_count
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
            AND t.date >= ${start} AND t.date <= ${end}
            AND t.type = 'DEBIT'`,
      // Maior gasto único no período
      sql`SELECT t.description, ABS(t.amount)::float as amount, t.date::text as date
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
            AND t.date >= ${start} AND t.date <= ${end}
            AND t.type = 'DEBIT'
          ORDER BY ABS(t.amount) DESC LIMIT 1`,
      // Uso diário de crédito no período (para gráfico)
      sql`SELECT t.date::text as date,
                 SUM(ABS(t.amount))::float as daily_spent
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
            AND t.date >= ${start} AND t.date <= ${end}
            AND t.type = 'DEBIT'
          GROUP BY t.date ORDER BY t.date`,
      // Top 5 categorias de crédito no período
      sql`SELECT COALESCE(t.category, 'Sem categoria') as category,
                 SUM(ABS(t.amount))::float as total,
                 COUNT(*)::int as count
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
            AND t.date >= ${start} AND t.date <= ${end}
            AND t.type = 'DEBIT'
          GROUP BY COALESCE(t.category, 'Sem categoria')
          ORDER BY total DESC LIMIT 5`,
      // Consultas ao CPF no período
      sql`SELECT id, consulted_at::text as consulted_at, institution, type
          FROM cpf_consultations
          WHERE consulted_at >= ${start} AND consulted_at <= ${end}
          ORDER BY consulted_at DESC`,
    ]);

    // Métricas de crédito atuais
    const totalLimit = creditAccounts.reduce((s, c) => s + num(c.credit_limit), 0);
    const totalUsed = creditAccounts.reduce((s, c) => s + Math.abs(num(c.balance)), 0);
    const totalAvailable = Math.max(totalLimit - totalUsed, 0);
    const creditCompromised = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Limites por banco
    const bankMap = new Map<string, { limit: number; used: number; available: number }>();
    for (const c of creditAccounts) {
      const inst = c.institution_name || "Desconhecido";
      const used = Math.abs(num(c.balance));
      const limit = num(c.credit_limit);
      const e = bankMap.get(inst) || { limit: 0, used: 0, available: 0 };
      e.limit += limit; e.used += used; e.available += Math.max(limit - used, 0);
      bankMap.set(inst, e);
    }
    const limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }> = [];
    bankMap.forEach((val, institution) => { limitsByBank.push({ institution, ...val }); });

    const totalLoanDebt = loans.reduce((s, l) => s + num(l.outstanding_balance), 0);

    // Dados do período
    const periodSpent = num(periodTx[0]?.total_spent);
    const periodTxCount = num(periodTx[0]?.tx_count);
    const avgUsage = totalLimit > 0 ? Math.round((periodSpent / totalLimit) * 100) : 0;

    // Gráfico: uso acumulado dia a dia
    let runningTotal = 0;
    const usageChart = dailyUsage.map((d) => {
      runningTotal += num(d.daily_spent);
      return {
        date: d.date,
        spent: num(d.daily_spent),
        accumulated: runningTotal,
        usagePercent: totalLimit > 0 ? Math.round((runningTotal / totalLimit) * 100) : 0,
      };
    });

    // Top categorias traduzidas
    const categories = topCategories.map((c) => ({
      category: translateCategory(c.category),
      total: num(c.total),
      count: num(c.count),
      percent: periodSpent > 0 ? Math.round((num(c.total) / periodSpent) * 100) : 0,
    }));

    // Consultas CPF recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const recentCpfConsults = await sql`
      SELECT COUNT(*)::int as count FROM cpf_consultations
      WHERE consulted_at >= ${thirtyDaysAgo}`;
    const hasRecentCpfConsult = num(recentCpfConsults[0]?.count) > 0;

    return NextResponse.json({
      // Métricas atuais
      totalLimit, totalUsed, totalAvailable, creditCompromised, limitsByBank,
      loans: loans.map((l) => ({ ...l, institution_name: l.institution_name || "Desconhecido" })),
      totalLoanDebt,
      score: scoreRows[0] || null,
      // Dados do período
      periodSpent, periodTxCount, avgUsage,
      biggestTransaction: biggestTx[0] || null,
      usageChart,
      topCategories: categories,
      // Score histórico
      scoreHistory: allScores,
      // Consultas CPF
      cpfConsultations: cpfConsultations || [],
      hasRecentCpfConsult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar crédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
