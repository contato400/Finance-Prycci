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

// Calcula métricas e salva em dashboard_cache. Chamada após sync.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Query combinada: métricas de contas + investimentos em 1 query
    const [totals] = await sql`
      SELECT
        SUM(CASE WHEN type NOT IN ('CREDIT','CREDIT_CARD') THEN balance ELSE 0 END)::float AS total_balance,
        SUM(CASE WHEN type IN ('CREDIT','CREDIT_CARD') THEN ABS(balance) ELSE 0 END)::float AS total_credit_used,
        SUM(CASE WHEN type IN ('CREDIT','CREDIT_CARD') THEN COALESCE(credit_limit,0) ELSE 0 END)::float AS total_limit,
        (SELECT COALESCE(SUM(balance),0)::float FROM investments) AS total_invested
      FROM accounts
    `;

    const totalBalance = num(totals?.total_balance);
    const totalCreditUsed = num(totals?.total_credit_used);
    const totalCreditLimit = num(totals?.total_limit);
    const totalInvested = num(totals?.total_invested);
    const netBalance = totalBalance - totalCreditUsed;

    // Bancos conectados
    const items = await sql`SELECT id, institution_name FROM pluggy_items`;
    const itemMap = new Map<string, string>();
    for (const i of items) itemMap.set(i.id, i.institution_name);

    // Instituições com saldos
    const accounts = await sql`
      SELECT item_id, type, balance::float AS balance,
             COALESCE(credit_limit,0)::float AS credit_limit
      FROM accounts
    `;

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

    // Gráfico (30 dias)
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

    await sql`
      INSERT INTO dashboard_cache (id, data, updated_at)
      VALUES (1, ${JSON.stringify(cacheData)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `;

    return NextResponse.json({ success: true, ...cacheData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao construir cache";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
