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

    // 2. Bancos conectados — sem duplicatas, apenas banco + status
    const banks = await sql`
      SELECT DISTINCT
        CASE WHEN pi.institution_name = 'MeuPluggy' THEN
          CASE
            WHEN EXISTS(SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%nubank%') THEN 'Nubank'
            WHEN EXISTS(SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%inter%') THEN 'Banco Inter'
            WHEN EXISTS(SELECT 1 FROM accounts a WHERE a.item_id = pi.id AND a.name ILIKE '%caixa%') THEN 'Caixa Econômica Federal'
            ELSE pi.institution_name
          END
        ELSE pi.institution_name END AS banco,
        pi.status
      FROM pluggy_items pi
      GROUP BY banco, pi.status
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
        CASE
          WHEN pi.institution_name = 'MeuPluggy' THEN
            CASE
              WHEN a.name ILIKE '%nubank%' OR a.name ILIKE '%nu pagamento%' THEN 'Nubank'
              WHEN a.name ILIKE '%inter%' THEN 'Banco Inter'
              WHEN a.name ILIKE '%caixa%' THEN 'Caixa Econômica Federal'
              WHEN a.name ILIKE '%bradesco%' THEN 'Bradesco'
              WHEN a.name ILIKE '%itau%' OR a.name ILIKE '%itaú%' THEN 'Itaú'
              WHEN a.name ILIKE '%santander%' THEN 'Santander'
              WHEN a.name ILIKE '%c6%' THEN 'C6 Bank'
              ELSE a.name
            END
          ELSE pi.institution_name
        END AS banco
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
        name: b.banco,
        status: b.status,
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
