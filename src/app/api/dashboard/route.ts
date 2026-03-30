import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const revalidate = 30;

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Dashboard: todas as métricas em queries SQL otimizadas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Uma ÚNICA query CTE que calcula tudo de uma vez
    const [metrics] = await sql`
      WITH bank_totals AS (
        SELECT COALESCE(SUM(balance), 0)::float AS total_balance
        FROM accounts WHERE type NOT IN ('CREDIT', 'CREDIT_CARD')
      ),
      credit_totals AS (
        SELECT COALESCE(SUM(ABS(balance)), 0)::float AS total_used,
               COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS total_limit
        FROM accounts WHERE type IN ('CREDIT', 'CREDIT_CARD')
      ),
      inv_totals AS (
        SELECT COALESCE(SUM(balance), 0)::float AS total_invested FROM investments
      ),
      item_count AS (
        SELECT count(*)::int AS total FROM pluggy_items
      )
      SELECT bt.total_balance, ct.total_used, ct.total_limit,
             it.total_invested, ic.total AS connected_banks
      FROM bank_totals bt, credit_totals ct, inv_totals it, item_count ic
    `;

    const totalBalance = num(metrics.total_balance);
    const totalCreditUsed = num(metrics.total_used);
    const totalCreditLimit = num(metrics.total_limit);
    const totalInvested = num(metrics.total_invested);
    const connectedBanks = num(metrics.connected_banks);
    const netBalance = totalBalance - totalCreditUsed;

    // Instituições e transações em paralelo
    const [allAccounts, transactions] = await Promise.all([
      sql`SELECT a.type, a.balance::float AS balance,
                 COALESCE(a.credit_limit, 0)::float AS credit_limit,
                 p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id`,
      sql`SELECT date::text AS date, amount::float AS amount
          FROM transactions WHERE date >= ${thirtyDaysAgo} ORDER BY date ASC`,
    ]);

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
    for (const tx of transactions) txByDay.set(String(tx.date), (txByDay.get(String(tx.date)) || 0) + num(tx.amount));

    const balanceHistory: { date: string; balance: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayDelta = txByDay.get(dateStr) || 0;
      balanceHistory.push({ date: dateStr, balance: Math.round((totalBalance - dayDelta * (i / 10)) * 100) / 100 });
    }

    return NextResponse.json({
      totalBalance, totalCreditUsed, totalCreditLimit, totalInvested, netBalance,
      institutions: Array.from(instData.values()),
      balanceHistory,
      connectedBanks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
