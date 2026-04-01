import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const start = searchParams.get("start") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = searchParams.get("end") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Cartões de crédito — direto da tabela accounts (credit_cards pode estar vazia)
    const creditAccounts = await sql`
      SELECT a.id, a.name, a.type,
             a.balance::float AS balance,
             COALESCE(a.credit_limit, 0)::float AS credit_limit,
             p.institution_name AS bank_name
      FROM accounts a
      LEFT JOIN pluggy_items p ON a.item_id = p.id
      WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
      ORDER BY ABS(a.balance) DESC
    `;

    // Métricas dos 4 cards
    const totalLimit = creditAccounts.reduce((s, c) => s + num(c.credit_limit), 0);
    const totalUsed = creditAccounts.reduce((s, c) => s + Math.abs(num(c.balance)), 0);
    const totalAvailable = Math.max(totalLimit - totalUsed, 0);
    const creditCompromised = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Limites por banco
    const limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }> = [];
    const bankMap = new Map<string, { limit: number; used: number; available: number }>();
    for (const c of creditAccounts) {
      const inst = c.bank_name || "Desconhecido";
      const used = Math.abs(num(c.balance));
      const limit = num(c.credit_limit);
      const e = bankMap.get(inst) || { limit: 0, used: 0, available: 0 };
      e.limit += limit;
      e.used += used;
      e.available += Math.max(limit - used, 0);
      bankMap.set(inst, e);
    }
    bankMap.forEach((val, institution) => { limitsByBank.push({ institution, ...val }); });

    // Queries do período — todas em paralelo, usando amount < 0 (não t.type = 'DEBIT')
    const creditAccountIds = creditAccounts.map((c) => c.id);
    let periodSpent = 0, periodTxCount = 0;
    let biggestTransaction: { description: string; amount: number; date: string } | null = null;
    let usageChart: Array<{ date: string; spent: number; accumulated: number; usagePercent: number }> = [];
    let topCategories: Array<{ category: string; total: number; count: number; percent: number }> = [];

    if (creditAccountIds.length > 0) {
      const [periodRow, biggestRow, dailyRows, catRows] = await Promise.all([
        sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total_spent,
                   COUNT(*)::int AS tx_count
            FROM transactions
            WHERE account_id = ANY(${creditAccountIds}::uuid[])
              AND amount < 0
              AND date >= ${start} AND date <= ${end}`,
        sql`SELECT description, ABS(amount)::float AS amount, date::text AS date
            FROM transactions
            WHERE account_id = ANY(${creditAccountIds}::uuid[])
              AND amount < 0
              AND date >= ${start} AND date <= ${end}
            ORDER BY ABS(amount) DESC LIMIT 1`,
        sql`SELECT date::text AS date, SUM(ABS(amount))::float AS daily_spent
            FROM transactions
            WHERE account_id = ANY(${creditAccountIds}::uuid[])
              AND amount < 0
              AND date >= ${start} AND date <= ${end}
            GROUP BY date ORDER BY date`,
        sql`SELECT COALESCE(category, 'Sem categoria') AS category,
                   SUM(ABS(amount))::float AS total,
                   COUNT(*)::int AS count
            FROM transactions
            WHERE account_id = ANY(${creditAccountIds}::uuid[])
              AND amount < 0
              AND date >= ${start} AND date <= ${end}
            GROUP BY COALESCE(category, 'Sem categoria')
            ORDER BY total DESC LIMIT 5`,
      ]);

      periodSpent = num(periodRow[0]?.total_spent);
      periodTxCount = num(periodRow[0]?.tx_count);
      biggestTransaction = biggestRow[0] ? { description: biggestRow[0].description, amount: num(biggestRow[0].amount), date: biggestRow[0].date } : null;

      let running = 0;
      usageChart = dailyRows.map((d) => {
        running += num(d.daily_spent);
        return { date: d.date, spent: num(d.daily_spent), accumulated: running, usagePercent: totalLimit > 0 ? Math.round((running / totalLimit) * 100) : 0 };
      });

      topCategories = catRows.map((c) => ({
        category: translateCategory(c.category),
        total: num(c.total),
        count: num(c.count),
        percent: periodSpent > 0 ? Math.round((num(c.total) / periodSpent) * 100) : 0,
      }));
    }

    const avgUsage = totalLimit > 0 ? Math.round((periodSpent / totalLimit) * 100) : 0;

    // Empréstimos, score, CPF — queries simples
    const [loans, scoreRows, allScores, cpfConsultations] = await Promise.all([
      sql`SELECT *, COALESCE(outstanding_balance, 0)::float AS outstanding_balance FROM loans ORDER BY updated_at DESC`,
      sql`SELECT * FROM credit_score ORDER BY updated_at DESC LIMIT 1`,
      sql`SELECT score, source, recorded_at::text AS recorded_at, updated_at FROM credit_score WHERE recorded_at >= ${start} AND recorded_at <= ${end} ORDER BY recorded_at ASC`,
      sql`SELECT id, consulted_at::text AS consulted_at, institution, type FROM cpf_consultations WHERE consulted_at >= ${start} AND consulted_at <= ${end} ORDER BY consulted_at DESC`,
    ]);

    const totalLoanDebt = loans.reduce((s, l) => s + num(l.outstanding_balance), 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const recentCpf = await sql`SELECT COUNT(*)::int AS count FROM cpf_consultations WHERE consulted_at >= ${thirtyDaysAgo}`;

    return NextResponse.json({
      totalLimit, totalUsed, totalAvailable, creditCompromised,
      limitsByBank,
      loans: loans.map((l) => ({ ...l, institution_name: l.institution_name || "Desconhecido" })),
      totalLoanDebt,
      score: scoreRows[0] || null,
      periodSpent, periodTxCount, avgUsage,
      biggestTransaction,
      usageChart,
      topCategories,
      scoreHistory: allScores,
      cpfConsultations: cpfConsultations || [],
      hasRecentCpfConsult: num(recentCpf[0]?.count) > 0,
      // Debug
      _debug: {
        creditAccountsFound: creditAccounts.length,
        creditAccountTypes: creditAccounts.map((c) => c.type),
        creditAccountIds: creditAccountIds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar crédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
