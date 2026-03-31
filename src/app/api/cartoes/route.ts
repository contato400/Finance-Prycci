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

// Retorna cartões de crédito — busca de accounts type=CREDIT
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");
    const now = new Date();
    const start = searchParams.get("start") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = searchParams.get("end") ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const cards = await sql`
      SELECT a.id, a.pluggy_account_id, a.name, a.type,
             a.balance::float as balance,
             COALESCE(a.credit_limit, 0)::float as credit_limit,
             a.updated_at,
             CASE
               WHEN p.institution_name = 'MeuPluggy' THEN
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
               ELSE p.institution_name
             END AS institution_name
      FROM accounts a
      JOIN pluggy_items p ON a.item_id = p.id
      WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
      ORDER BY a.updated_at DESC`;

    const enrichedCards = cards.map((c) => {
      const usedBalance = Math.abs(num(c.balance));
      const creditLimit = num(c.credit_limit);
      const availableLimit = Math.max(creditLimit - usedBalance, 0);
      const last4 = c.pluggy_account_id?.slice(-4) || "****";

      return {
        id: c.id,
        account_id: c.id,
        name: `${c.institution_name || ""} ${c.name || ""}`.trim(),
        last4,
        balance: usedBalance,
        credit_limit: creditLimit,
        available_limit: availableLimit,
        updated_at: c.updated_at,
        accounts: { pluggy_items: { institution_name: c.institution_name || "Desconhecido" } },
      };
    });

    let transactions = null;
    if (cardId) {
      const rawTx = await sql`
        SELECT *, amount::float as amount FROM transactions
        WHERE account_id = ${cardId}::uuid
          AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC LIMIT 50`;
      transactions = rawTx.map((tx) => ({ ...tx, category: translateCategory(tx.category) }));
    }

    const totalUsed = enrichedCards.reduce((s, c) => s + c.balance, 0);
    const totalLimit = enrichedCards.reduce((s, c) => s + c.credit_limit, 0);
    const totalAvailable = enrichedCards.reduce((s, c) => s + c.available_limit, 0);

    return NextResponse.json({ cards: enrichedCards, transactions, totalUsed, totalLimit, totalAvailable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar cartões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
