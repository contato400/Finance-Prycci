import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { translateCategory } from "@/lib/categories";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Retorna cartões de crédito — busca diretamente de accounts type=CREDIT
// (a tabela credit_cards pode estar vazia se o sync não populou)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");

    // Buscar contas de crédito (cartões) direto da tabela accounts
    const cards = await sql`
      SELECT a.id, a.pluggy_account_id, a.name, a.type, a.balance,
             a.credit_limit, a.currency, a.updated_at,
             p.institution_name
      FROM accounts a
      JOIN pluggy_items p ON a.item_id = p.id
      WHERE a.type IN ('CREDIT', 'CREDIT_CARD')
      ORDER BY a.updated_at DESC`;

    // Mapear para o formato esperado pelo frontend
    const enrichedCards = cards.map((c) => {
      const usedBalance = Math.abs(Number(c.balance));
      const creditLimit = Number(c.credit_limit || 0);
      const availableLimit = Math.max(creditLimit - usedBalance, 0);
      // Extrair últimos 4 dígitos do nome ou pluggy_account_id
      const last4 = c.pluggy_account_id?.slice(-4) || "****";

      return {
        id: c.id,
        account_id: c.id, // Para buscar transações
        name: `${c.institution_name || ""} ${c.name || ""}`.trim(),
        last4,
        balance: usedBalance,
        credit_limit: creditLimit,
        available_limit: availableLimit,
        updated_at: c.updated_at,
        accounts: { pluggy_items: { institution_name: c.institution_name || "Desconhecido" } },
      };
    });

    // Transações do cartão selecionado
    let transactions = null;
    if (cardId) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const rawTx = await sql`
        SELECT * FROM transactions
        WHERE account_id = ${cardId}::uuid
          AND date >= ${thirtyDaysAgo.toISOString().split("T")[0]}
        ORDER BY date DESC LIMIT 30`;
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
