import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { translateCategory } from "@/lib/categories";
import { translateInstitution } from "@/lib/institutions";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Retorna cartões de crédito
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

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
             p.institution_name
      FROM accounts a
      JOIN pluggy_items p ON a.item_id = p.id
      WHERE a.user_id = ${userId}
        AND (a.type IN ('CREDIT', 'CREDIT_CARD') OR COALESCE(a.credit_limit, 0) > 0)
      ORDER BY a.updated_at DESC`;

    const enrichedCards = cards.map((c) => {
      const usedBalance = Math.abs(num(c.balance));
      const creditLimit = num(c.credit_limit);
      const availableLimit = Math.max(creditLimit - usedBalance, 0);
      const last4 = c.pluggy_account_id?.slice(-4) || "****";
      const banco = translateInstitution(c.institution_name);
      const cardName = (c.name || "").trim() || banco;

      return {
        id: c.id,
        account_id: c.id,
        name: cardName,
        last4,
        balance: usedBalance,
        credit_limit: creditLimit,
        available_limit: availableLimit,
        updated_at: c.updated_at,
        accounts: { pluggy_items: { institution_name: banco } },
      };
    });

    let transactions = null;
    if (cardId) {
      const rawTx = await sql`
        SELECT *, amount::float as amount FROM transactions
        WHERE account_id = ${cardId}::uuid
          AND user_id = ${userId}
          AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC LIMIT 50`;
      transactions = rawTx.map((tx) => ({ ...tx, category: translateCategory(tx.category) }));
    }

    const totalUsed = enrichedCards.reduce((s, c) => s + c.balance, 0);
    const totalLimit = enrichedCards.reduce((s, c) => s + c.credit_limit, 0);
    const totalAvailable = enrichedCards.reduce((s, c) => s + c.available_limit, 0);

    return NextResponse.json({ cards: enrichedCards, transactions, totalUsed, totalLimit, totalAvailable });
  } catch (error) {
    console.error("Cartoes error:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      cards: [], transactions: null, totalUsed: 0, totalLimit: 0, totalAvailable: 0,
      _error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
