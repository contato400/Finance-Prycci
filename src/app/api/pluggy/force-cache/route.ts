import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Força recálculo do dashboard_cache a partir dos dados existentes no banco
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    // Calcular tudo com queries simples separadas (mais confiável que jsonb_build_object com subqueries)
    const [balanceRow, creditRow, invRow, bankCount, accountsList] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE type NOT IN ('CREDIT', 'CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS total_used,
                 COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS total_limit
          FROM accounts WHERE type IN ('CREDIT', 'CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total, COUNT(*)::int AS count FROM investments`,
      sql`SELECT COUNT(*)::int AS total FROM pluggy_items`,
      sql`SELECT a.type, a.balance::float AS balance, COALESCE(a.credit_limit,0)::float AS credit_limit,
                 p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id`,
    ]);

    const totalBalance = num(balanceRow[0]?.total);
    const totalCreditUsed = num(creditRow[0]?.total_used);
    const totalCreditLimit = num(creditRow[0]?.total_limit);
    const totalInvested = num(invRow[0]?.total);
    const investmentCount = num(invRow[0]?.count);
    const connectedBanks = num(bankCount[0]?.total);
    const netBalance = totalBalance + totalInvested - totalCreditUsed;

    // Instituições agrupadas
    const instMap = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();
    for (const a of accountsList) {
      const name = a.institution_name || "Desconhecido";
      const e = instMap.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      if (a.type === "CREDIT" || a.type === "CREDIT_CARD") {
        e.creditLimit += num(a.credit_limit);
        e.creditUsed += Math.abs(num(a.balance));
      } else {
        e.balance += num(a.balance);
      }
      instMap.set(name, e);
    }

    const cacheData = {
      totalBalance,
      totalCreditUsed,
      totalCreditLimit,
      totalInvested,
      investmentCount,
      netBalance,
      connectedBanks,
      institutions: Array.from(instMap.values()),
    };

    // Salvar como JSON string → JSONB
    await sql`
      INSERT INTO dashboard_cache (id, data, updated_at)
      VALUES (1, ${JSON.stringify(cacheData)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;

    // Verificar que foi salvo
    const verify = await sql`SELECT data FROM dashboard_cache WHERE id = 1`;

    return Response.json({
      message: "Cache atualizado com sucesso",
      saved: cacheData,
      verified: verify[0]?.data || null,
    });
  } catch (error) {
    console.error("FORCE-CACHE ERROR:", error instanceof Error ? error.message : String(error));
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
