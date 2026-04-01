import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { translateInstitution } from "@/lib/institutions";
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

    // === SEÇÃO 1: Score FinanceOS calculado ===
    // Renda média mensal últimos 3 meses
    const avgIncomeRow = await sql`
      SELECT AVG(total)::float AS avg_income FROM (
        SELECT DATE_TRUNC('month', date) AS mes, SUM(amount) AS total
        FROM transactions WHERE user_id = ${userId} AND amount > 0
        AND date >= NOW() - INTERVAL '3 months'
        GROUP BY mes
      ) t`;
    const avgIncome = num(avgIncomeRow[0]?.avg_income);

    // Gastos médios mensais últimos 3 meses
    const avgExpenseRow = await sql`
      SELECT AVG(total)::float AS avg_expense FROM (
        SELECT DATE_TRUNC('month', date) AS mes, SUM(ABS(amount)) AS total
        FROM transactions WHERE user_id = ${userId} AND amount < 0
        AND date >= NOW() - INTERVAL '3 months'
        GROUP BY mes
      ) t`;
    const avgExpense = num(avgExpenseRow[0]?.avg_expense);

    // Crédito: utilização
    const creditRow = await sql`
      SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used,
             COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim
      FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT', 'CREDIT_CARD')`;
    const creditUsed = num(creditRow[0]?.used);
    const creditLimit = num(creditRow[0]?.lim);

    // Regularidade: meses com pagamento de fatura/boleto nos últimos 3
    const regularityRow = await sql`
      SELECT COUNT(DISTINCT DATE_TRUNC('month', date))::int AS months_paid
      FROM transactions WHERE user_id = ${userId} AND amount < 0
      AND (description ILIKE '%fatura%' OR description ILIKE '%boleto%' OR description ILIKE '%pagamento%')
      AND date >= NOW() - INTERVAL '3 months'`;
    const monthsPaid = num(regularityRow[0]?.months_paid);

    // Diversificação
    const [invRow, bankCountRow, balanceRow] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM investments WHERE user_id = ${userId}`,
      sql`SELECT COUNT(DISTINCT institution_name)::int AS total FROM pluggy_items WHERE user_id = ${userId}`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT', 'CREDIT_CARD')`,
    ]);
    const totalInvestments = num(invRow[0]?.total);
    const bankCount = num(bankCountRow[0]?.total);
    const totalBalance = num(balanceRow[0]?.total);

    // Calcular pontos
    const incomeScore = avgIncome > 5000 ? 200 : avgIncome > 3000 ? 150 : avgIncome > 1500 ? 100 : 50;
    const ratio = avgIncome > 0 ? avgExpense / avgIncome : 1;
    const commitScore = ratio < 0.3 ? 200 : ratio < 0.5 ? 150 : ratio < 0.7 ? 100 : 50;
    const creditRatio = creditLimit > 0 ? creditUsed / creditLimit : 0;
    const creditScore = creditLimit === 0 ? 100 : creditRatio < 0.3 ? 200 : creditRatio < 0.6 ? 150 : creditRatio < 0.9 ? 100 : 50;
    const regularityScore = monthsPaid >= 3 ? 200 : monthsPaid === 2 ? 130 : monthsPaid === 1 ? 70 : 0;
    let diversScore = 0;
    if (totalInvestments > 1000) diversScore += 100;
    if (bankCount > 1) diversScore += 50;
    if (avgExpense > 0 && totalBalance > avgExpense) diversScore += 50;

    const totalScore = Math.min(1000, incomeScore + commitScore + creditScore + regularityScore + diversScore);

    // Salvar score calculado
    const today = new Date().toISOString().split("T")[0];
    await sql`
      INSERT INTO credit_score (user_id, score, source, recorded_at, updated_at)
      VALUES (${userId}, ${totalScore}, 'FinanceOS', ${today}, NOW())
      ON CONFLICT ON CONSTRAINT credit_score_pkey DO NOTHING`;

    const scoreBreakdown = {
      total: totalScore,
      income: { score: incomeScore, avgIncome },
      commitment: { score: commitScore, ratio: Math.round(ratio * 100) },
      creditUsage: { score: creditScore, ratio: Math.round(creditRatio * 100) },
      regularity: { score: regularityScore, monthsPaid },
      diversification: { score: diversScore, investments: totalInvestments, banks: bankCount, balance: totalBalance },
    };

    // === SEÇÃO 2: Capacidade de Empréstimo ===
    const disponivel = Math.max(avgIncome - avgExpense, 0);
    const parcelaMax = disponivel * 0.30;
    const loanCapacity = {
      avgIncome, avgExpense, disponivel, parcelaMax,
      credito12x: parcelaMax * 12,
      credito24x: parcelaMax * 24,
      credito36x: parcelaMax * 36,
    };

    // === SEÇÃO 4: Cartões de crédito por banco ===
    const creditAccounts = await sql`
      SELECT a.id, a.name, a.type,
             a.balance::float AS balance,
             COALESCE(a.credit_limit, 0)::float AS credit_limit,
             p.institution_name
      FROM accounts a
      JOIN pluggy_items p ON a.item_id = p.id
      WHERE a.user_id = ${userId}
        AND a.type IN ('CREDIT', 'CREDIT_CARD')
        AND COALESCE(a.credit_limit, 0) > 0
      ORDER BY a.credit_limit DESC`;

    const cardsByBank = creditAccounts.map((c) => ({
      name: c.name,
      institution: translateInstitution(c.institution_name),
      limit: num(c.credit_limit),
      used: Math.abs(num(c.balance)),
      available: Math.max(num(c.credit_limit) - Math.abs(num(c.balance)), 0),
    }));

    const totalCreditLimit = cardsByBank.reduce((s, c) => s + c.limit, 0);
    const totalCreditUsed = cardsByBank.reduce((s, c) => s + c.used, 0);

    // === SEÇÃO 5: Consultas CPF ===
    const [cpfConsultations, recentCpfCount] = await Promise.all([
      sql`SELECT id, consulted_at::text AS consulted_at, institution, type
          FROM cpf_consultations WHERE user_id = ${userId}
          ORDER BY consulted_at DESC LIMIT 20`,
      sql`SELECT COUNT(*)::int AS count FROM cpf_consultations
          WHERE user_id = ${userId} AND consulted_at >= NOW() - INTERVAL '30 days'`,
    ]);

    // === SEÇÃO extra: Empréstimos ativos ===
    const loans = await sql`
      SELECT *, COALESCE(outstanding_balance, 0)::float AS outstanding_balance
      FROM loans WHERE user_id = ${userId} ORDER BY updated_at DESC`;
    const totalLoanDebt = loans.reduce((s, l) => s + num(l.outstanding_balance), 0);

    return NextResponse.json({
      scoreBreakdown,
      loanCapacity,
      cardsByBank,
      totalCreditLimit, totalCreditUsed,
      totalCreditAvailable: Math.max(totalCreditLimit - totalCreditUsed, 0),
      loans: loans.map((l) => ({ ...l, institution_name: translateInstitution(l.institution_name) })),
      totalLoanDebt,
      cpfConsultations: cpfConsultations || [],
      recentCpfCount: num(recentCpfCount[0]?.count),
    });
  } catch (error) {
    console.error("Credito error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      scoreBreakdown: { total: 0, income: { score: 0, avgIncome: 0 }, commitment: { score: 0, ratio: 0 }, creditUsage: { score: 0, ratio: 0 }, regularity: { score: 0, monthsPaid: 0 }, diversification: { score: 0, investments: 0, banks: 0, balance: 0 } },
      loanCapacity: { avgIncome: 0, avgExpense: 0, disponivel: 0, parcelaMax: 0, credito12x: 0, credito24x: 0, credito36x: 0 },
      cardsByBank: [], totalCreditLimit: 0, totalCreditUsed: 0, totalCreditAvailable: 0,
      loans: [], totalLoanDebt: 0, cpfConsultations: [], recentCpfCount: 0,
      _error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
