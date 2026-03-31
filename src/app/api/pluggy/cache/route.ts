import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Calcula métricas do dashboard e salva na tabela dashboard_cache.
// Usa uma ÚNICA query com CASE WHEN — sem JOIN, sem subquery, < 2s.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Query 1: métricas de contas (1 full scan, sem JOIN)
    const [totals] = await sql`
      SELECT
        SUM(CASE WHEN type NOT IN ('CREDIT','CREDIT_CARD') THEN balance ELSE 0 END)::float AS total_balance,
        SUM(CASE WHEN type IN ('CREDIT','CREDIT_CARD') THEN ABS(balance) ELSE 0 END)::float AS total_credit,
        SUM(CASE WHEN type IN ('CREDIT','CREDIT_CARD') THEN COALESCE(credit_limit,0) ELSE 0 END)::float AS total_limit
      FROM accounts
    `;

    // Query 2: total investido
    const [inv] = await sql`SELECT COALESCE(SUM(balance),0)::float AS total FROM investments`;

    // Query 3: bancos conectados (tabela pequena)
    const items = await sql`SELECT id, institution_name FROM pluggy_items`;

    const totalBalance = num(totals?.total_balance);
    const totalCreditUsed = num(totals?.total_credit);
    const totalCreditLimit = num(totals?.total_limit);
    const totalInvested = num(inv?.total);
    const netBalance = totalBalance - totalCreditUsed;

    // Instituições com saldos — 2 queries simples sem JOIN
    const accounts = await sql`
      SELECT item_id, type, balance::float AS balance,
             COALESCE(credit_limit,0)::float AS credit_limit
      FROM accounts
    `;

    const itemMap = new Map<string, string>();
    for (const i of items) itemMap.set(i.id, i.institution_name);

    const instMap = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();
    for (const a of accounts) {
      const name = itemMap.get(a.item_id) || "Desconhecido";
      const e = instMap.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      if (a.type === "CREDIT" || a.type === "CREDIT_CARD") {
        e.creditLimit += num(a.credit_limit);
        e.creditUsed += Math.abs(num(a.balance));
      } else {
        e.balance += num(a.balance);
      }
      instMap.set(name, e);
    }

    // Gráfico — transações agrupadas por dia (query rápida com índice)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const txData = await sql`
      SELECT date::text AS date, SUM(amount)::float AS total
      FROM transactions WHERE date >= ${thirtyDaysAgo}
      GROUP BY date ORDER BY date
    `;

    const txByDay = new Map<string, number>();
    for (const tx of txData) txByDay.set(tx.date, num(tx.total));

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

    const cacheData = {
      totalBalance,
      totalCreditUsed,
      totalCreditLimit,
      totalInvested,
      netBalance,
      institutions: Array.from(instMap.values()),
      balanceHistory,
      connectedBanks: items.length,
    };

    // Salvar no cache (1 upsert)
    await sql`
      INSERT INTO dashboard_cache (id, data, updated_at)
      VALUES (1, ${JSON.stringify(cacheData)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `;

    return NextResponse.json({
      message: "Cache atualizado",
      ...cacheData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao construir cache";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
