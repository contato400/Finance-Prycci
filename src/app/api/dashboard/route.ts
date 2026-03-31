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

    // 1. Saldos atuais do cache
    const cacheRows = await sql`SELECT data, updated_at FROM dashboard_cache WHERE id = 1 LIMIT 1`;

    if (!cacheRows.length || !cacheRows[0].data || Object.keys(cacheRows[0].data).length === 0) {
      return NextResponse.json({
        totalBalance: 0, totalCreditUsed: 0, totalCreditLimit: 0,
        totalInvested: 0, netBalance: 0, banks: [], connectedBanks: 0,
        periodIncome: 0, periodExpenses: 0, periodNet: 0, topTransactions: [],
        needsSync: true, message: "Clique em Sincronizar para carregar seus dados.",
      });
    }

    const c = cacheRows[0].data as Record<string, unknown>;
    const totalBalance = num(c.totalBalance ?? c.total_balance);
    const totalCreditUsed = num(c.totalCreditUsed ?? c.total_credit_used);
    const totalCreditLimit = num(c.totalCreditLimit ?? c.total_limit);
    const totalInvested = num(c.totalInvested ?? c.total_investments);
    const netBalance = totalBalance - totalCreditUsed;

    // 2. Bancos conectados — query dinâmica (não do cache)
    const banks = await sql`
      SELECT
        pi.id AS pi_id,
        pi.institution_name,
        pi.status,
        COUNT(a.id)::int AS total_contas,
        COALESCE(SUM(CASE WHEN a.type NOT IN ('CREDIT','CREDIT_CARD') THEN a.balance ELSE 0 END), 0)::float AS saldo_total,
        COALESCE(SUM(CASE WHEN a.type IN ('CREDIT','CREDIT_CARD') THEN ABS(a.balance) ELSE 0 END), 0)::float AS credito_usado,
        COALESCE(SUM(CASE WHEN a.type IN ('CREDIT','CREDIT_CARD') THEN COALESCE(a.credit_limit,0) ELSE 0 END), 0)::float AS credito_limite
      FROM pluggy_items pi
      LEFT JOIN accounts a ON a.item_id = pi.id
      GROUP BY pi.id, pi.institution_name, pi.status
      ORDER BY pi.institution_name
    `;

    const connectedBanks = banks.length;

    // 3. Movimentações do período
    const [incomeRow, expensesRow] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE amount > 0 AND date >= ${start} AND date <= ${end}`,
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total FROM transactions WHERE amount < 0 AND date >= ${start} AND date <= ${end}`,
    ]);

    const periodIncome = num(incomeRow[0]?.total);
    const periodExpenses = num(expensesRow[0]?.total);

    // 4. Top 10 transações individuais do período
    const topTxRows = await sql`
      SELECT
        t.id,
        t.description,
        ABS(t.amount)::float AS valor,
        t.date::text AS date,
        COALESCE(t.category, 'Sem categoria') AS category,
        a.type AS account_type,
        pi.institution_name AS banco
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN pluggy_items pi ON a.item_id = pi.id
      WHERE t.amount < 0
        AND t.date >= ${start} AND t.date <= ${end}
      ORDER BY ABS(t.amount) DESC
      LIMIT 10
    `;

    const topTransactions = topTxRows.map((tx) => ({
      id: tx.id,
      description: tx.description,
      valor: num(tx.valor),
      date: tx.date,
      category: translateCategory(tx.category),
      accountType: tx.account_type,
      banco: tx.banco,
    }));

    return NextResponse.json({
      totalBalance, totalCreditUsed, totalCreditLimit, totalInvested, netBalance,
      banks: banks.map((b) => ({
        name: b.institution_name,
        status: b.status,
        totalContas: num(b.total_contas),
        balance: num(b.saldo_total),
        creditUsed: num(b.credito_usado),
        creditLimit: num(b.credito_limite),
      })),
      connectedBanks,
      periodIncome,
      periodExpenses,
      periodNet: periodIncome - periodExpenses,
      topTransactions,
      cachedAt: cacheRows[0].updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
