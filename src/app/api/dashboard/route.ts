import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { translateCategory } from "@/lib/categories";
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

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const start = searchParams.get("start") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = searchParams.get("end") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Query TUDO direto das tabelas — sem depender do cache
    const [balRow, crRow, invRow, banksRows, incomeRow, expensesRow, topTxRows] = await Promise.all([
      // Saldo em contas correntes
      sql`SELECT COALESCE(SUM(balance), 0)::float AS v FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
      // Crédito
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      // Investimentos
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total, COUNT(*)::int AS count FROM investments WHERE user_id = ${userId}`,
      // Bancos conectados
      sql`SELECT institution_name, bool_or(status = 'UPDATED') AS ativo FROM pluggy_items WHERE user_id = ${userId} GROUP BY institution_name ORDER BY institution_name`,
      // Receitas do período
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= ${start} AND date <= ${end}`,
      // Gastos do período
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= ${start} AND date <= ${end}`,
      // Top 10 transações
      sql`SELECT t.id, t.description, ABS(t.amount)::float AS valor, t.date::text AS date,
            COALESCE(t.category, 'Sem categoria') AS category, a.type AS account_type,
            pi.institution_name AS banco
          FROM transactions t
          JOIN accounts a ON t.account_id = a.id
          JOIN pluggy_items pi ON a.item_id = pi.id
          WHERE t.user_id = ${userId} AND t.amount < 0 AND t.date >= ${start} AND t.date <= ${end}
          ORDER BY ABS(t.amount) DESC LIMIT 10`,
    ]);

    const totalBalance = num(balRow[0]?.v);
    const totalCreditUsed = num(crRow[0]?.used);
    const totalCreditLimit = num(crRow[0]?.lim);
    const totalInvested = num(invRow[0]?.total);
    const investmentCount = num(invRow[0]?.count);
    const netBalance = totalBalance + totalInvested - totalCreditUsed;
    const periodIncome = num(incomeRow[0]?.total);
    const periodExpenses = num(expensesRow[0]?.total);

    const topTransactions = topTxRows.map((tx) => ({
      id: tx.id, description: tx.description, valor: num(tx.valor), date: tx.date,
      category: translateCategory(tx.category), accountType: tx.account_type,
      banco: translateInstitution(tx.banco),
    }));

    return NextResponse.json({
      totalBalance, totalCreditUsed, totalCreditLimit, totalInvested, investmentCount, netBalance,
      banks: banksRows.map((b) => ({
        name: translateInstitution(b.institution_name),
        status: b.ativo ? "UPDATED" : "PENDING",
      })),
      connectedBanks: banksRows.length,
      periodIncome, periodExpenses,
      periodNet: periodIncome - periodExpenses,
      topTransactions,
    });
  } catch (error) {
    console.error("Dashboard error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      totalBalance: 0, totalCreditUsed: 0, totalCreditLimit: 0,
      totalInvested: 0, netBalance: 0, banks: [], connectedBanks: 0,
      periodIncome: 0, periodExpenses: 0, periodNet: 0, topTransactions: [],
      needsSync: true, message: "Erro ao carregar dados. Tente sincronizar.",
      _error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
