import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cachedJson } from "@/lib/cache";
import sql from "@/lib/db";

// Retorna cartões de crédito com transações e métricas
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");

    // Buscar cartões com institution_name via JOINs
    const cards = await sql`
      SELECT cc.*, p.institution_name
      FROM credit_cards cc
      JOIN accounts a ON cc.account_id = a.id
      JOIN pluggy_items p ON a.item_id = p.id
      ORDER BY cc.updated_at DESC`;

    const enrichedCards = cards.map((c) => ({
      ...c,
      accounts: { pluggy_items: { institution_name: c.institution_name } },
    }));

    // Transações do cartão selecionado
    let transactions = null;
    if (cardId) {
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        transactions = await sql`
          SELECT * FROM transactions
          WHERE account_id = ${card.account_id}::uuid
            AND date >= ${thirtyDaysAgo.toISOString().split("T")[0]}
          ORDER BY date DESC LIMIT 30`;
      }
    }

    const totalUsed = cards.reduce((s, c) => s + Number(c.balance), 0);
    const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
    const totalAvailable = cards.reduce((s, c) => s + Number(c.available_limit), 0);

    return cachedJson({ cards: enrichedCards, transactions, totalUsed, totalLimit, totalAvailable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar cartões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
