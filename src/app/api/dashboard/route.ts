import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Converte qualquer valor para number seguro (nunca NaN)
function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Dashboard: agrega dados de todas as tabelas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Agregar métricas via SQL para evitar problemas de tipo
    const [
      items,
      bankTotals,
      creditTotals,
      investmentTotals,
      allAccounts,
      transactions,
    ] = await Promise.all([
      sql`SELECT id, institution_name FROM pluggy_items`,
      // Saldo total de contas bancárias (tudo que NÃO é cartão de crédito)
      sql`SELECT
            COALESCE(SUM(balance), 0)::float as total_balance,
            count(*) as count
          FROM accounts
          WHERE type NOT IN ('CREDIT', 'CREDIT_CARD')`,
      // Crédito: contas de cartão de crédito
      sql`SELECT
            COALESCE(SUM(ABS(balance)), 0)::float as total_used,
            COALESCE(SUM(credit_limit), 0)::float as total_limit,
            count(*) as count
          FROM accounts
          WHERE type IN ('CREDIT', 'CREDIT_CARD')`,
      // Investimentos
      sql`SELECT COALESCE(SUM(balance), 0)::float as total FROM investments`,
      // Todas as contas com institution_name para agrupar
      sql`SELECT a.id, a.type, a.balance::float as balance,
                 COALESCE(a.credit_limit, 0)::float as credit_limit,
                 p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id`,
      // Transações últimos 30 dias
      sql`SELECT date::text as date, amount::float as amount
          FROM transactions
          WHERE date >= ${thirtyDaysAgo}
          ORDER BY date ASC`,
    ]);

    const totalBalance = num(bankTotals[0]?.total_balance);
    const totalCreditUsed = num(creditTotals[0]?.total_used);
    const totalCreditLimit = num(creditTotals[0]?.total_limit);
    const totalInvested = num(investmentTotals[0]?.total);
    const netBalance = totalBalance - totalCreditUsed;

    // Agrupar por instituição
    const instData = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();

    for (const a of allAccounts) {
      const name = a.institution_name || "Desconhecido";
      const e = instData.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      const isCredit = a.type === "CREDIT" || a.type === "CREDIT_CARD";

      if (isCredit) {
        e.creditLimit += num(a.credit_limit);
        e.creditUsed += Math.abs(num(a.balance));
      } else {
        e.balance += num(a.balance);
      }

      instData.set(name, e);
    }

    // Evolução do saldo
    const txByDay = new Map<string, number>();
    for (const tx of transactions) {
      const day = String(tx.date);
      txByDay.set(day, (txByDay.get(day) || 0) + num(tx.amount));
    }

    const balanceHistory: { date: string; balance: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayDelta = txByDay.get(dateStr) || 0;
      balanceHistory.push({
        date: dateStr,
        balance: Math.round((totalBalance - dayDelta * (i / 10)) * 100) / 100,
      });
    }

    return NextResponse.json({
      totalBalance,
      totalCreditUsed,
      totalCreditLimit,
      totalInvested,
      netBalance,
      institutions: Array.from(instData.values()),
      balanceHistory,
      connectedBanks: items.length,
      _debug: {
        items: items.length,
        bankAccountsCount: num(bankTotals[0]?.count),
        creditAccountsCount: num(creditTotals[0]?.count),
        allAccountsCount: allAccounts.length,
        transactionsCount: transactions.length,
        accountTypes: allAccounts.map((a) => a.type),
        rawBankTotal: bankTotals[0],
        rawCreditTotal: creditTotals[0],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
