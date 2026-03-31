import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

// Debug: mostra estado do cache e das tabelas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [cache, accounts, txCount, invCount, itemCount] = await Promise.all([
      sql`SELECT * FROM dashboard_cache WHERE id = 1`,
      sql`SELECT id, name, type, balance::float as balance, COALESCE(credit_limit,0)::float as credit_limit FROM accounts LIMIT 20`,
      sql`SELECT COUNT(*)::int as total FROM transactions`,
      sql`SELECT COUNT(*)::int as total FROM investments`,
      sql`SELECT COUNT(*)::int as total FROM pluggy_items`,
    ]);

    return NextResponse.json({
      cache: cache[0] || null,
      cacheDataKeys: cache[0]?.data ? Object.keys(cache[0].data) : [],
      cacheDataRaw: cache[0]?.data || null,
      accounts,
      counts: {
        transactions: txCount[0]?.total ?? 0,
        investments: invCount[0]?.total ?? 0,
        pluggy_items: itemCount[0]?.total ?? 0,
        accounts: accounts.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
