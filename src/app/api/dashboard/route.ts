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

// Executa query com fallback — se falhar retorna null ao invés de explodir
async function safeQuery<T>(query: Promise<T>, label: string): Promise<T | null> {
  try {
    return await query;
  } catch (e) {
    console.error(`[dashboard] ${label} falhou:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 3 queries SIMPLES, sem JOIN, sem CTE, sem subquery
    const [accountsByType, itemsList, investTotal] = await Promise.all([
      // Query 1: contas agrupadas por tipo
      safeQuery(
        sql`SELECT type,
                   SUM(balance)::float AS total_balance,
                   SUM(COALESCE(credit_limit, 0))::float AS total_limit,
                   COUNT(*)::int AS qty
            FROM accounts GROUP BY type`,
        "accounts"
      ),
      // Query 2: instituições conectadas
      safeQuery(
        sql`SELECT institution_name, COUNT(*)::int AS qty
            FROM pluggy_items GROUP BY institution_name`,
        "pluggy_items"
      ),
      // Query 3: total investido
      safeQuery(
        sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM investments`,
        "investments"
      ),
    ]);

    // Calcular métricas a partir dos resultados
    let totalBalance = 0;
    let totalCreditUsed = 0;
    let totalCreditLimit = 0;

    if (accountsByType) {
      for (const row of accountsByType) {
        const isCredit = row.type === "CREDIT" || row.type === "CREDIT_CARD";
        if (isCredit) {
          totalCreditUsed += Math.abs(num(row.total_balance));
          totalCreditLimit += num(row.total_limit);
        } else {
          totalBalance += num(row.total_balance);
        }
      }
    }

    const totalInvested = num(investTotal?.[0]?.total);
    const netBalance = totalBalance - totalCreditUsed;
    const connectedBanks = itemsList?.length ?? 0;

    // Instituições — lista simples de pluggy_items
    const institutions = (itemsList || []).map((row) => ({
      name: row.institution_name || "Desconhecido",
      balance: 0,
      creditLimit: 0,
      creditUsed: 0,
    }));

    // Enriquecer instituições com dados das contas (query extra simples, sem JOIN)
    const accountsDetail = await safeQuery(
      sql`SELECT item_id, type, balance::float AS balance,
                 COALESCE(credit_limit, 0)::float AS credit_limit
          FROM accounts`,
      "accounts_detail"
    );

    const itemToInst = new Map<string, string>();
    if (itemsList) {
      // Precisamos mapear item_id (uuid) → institution_name
      const itemsById = await safeQuery(
        sql`SELECT id, institution_name FROM pluggy_items`,
        "items_by_id"
      );
      if (itemsById) {
        for (const i of itemsById) itemToInst.set(i.id, i.institution_name);
      }
    }

    if (accountsDetail && itemToInst.size > 0) {
      const instMap = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();
      for (const a of accountsDetail) {
        const name = itemToInst.get(a.item_id) || "Desconhecido";
        const e = instMap.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
        const isCredit = a.type === "CREDIT" || a.type === "CREDIT_CARD";
        if (isCredit) {
          e.creditLimit += num(a.credit_limit);
          e.creditUsed += Math.abs(num(a.balance));
        } else {
          e.balance += num(a.balance);
        }
        instMap.set(name, e);
      }
      // Substituir lista de instituições
      if (instMap.size > 0) {
        institutions.length = 0;
        instMap.forEach((v) => institutions.push(v));
      }
    }

    // Gráfico de saldo — gerar linha plana se não houver transações
    const balanceHistory: { date: string; balance: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      balanceHistory.push({
        date: d.toISOString().split("T")[0],
        balance: Math.round(totalBalance * 100) / 100,
      });
    }

    // Tentar buscar transações para gráfico (query separada, pode falhar)
    const txData = await safeQuery(
      sql`SELECT date::text AS date, SUM(amount)::float AS total
          FROM transactions
          WHERE date >= ${new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]}
          GROUP BY date ORDER BY date`,
      "transactions_chart"
    );

    if (txData && txData.length > 0) {
      const txByDay = new Map<string, number>();
      for (const tx of txData) txByDay.set(tx.date, num(tx.total));

      for (let i = 29; i >= 0; i--) {
        const dateStr = balanceHistory[29 - i].date;
        const dayDelta = txByDay.get(dateStr) || 0;
        balanceHistory[29 - i].balance = Math.round((totalBalance - dayDelta * (i / 10)) * 100) / 100;
      }
    }

    return NextResponse.json({
      totalBalance, totalCreditUsed, totalCreditLimit, totalInvested, netBalance,
      institutions, balanceHistory, connectedBanks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
