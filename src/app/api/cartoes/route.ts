import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseSelect } from "@/lib/supabase/rest";

// Retorna cartões de crédito com transações e métricas
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");

    // Buscar cartões
    const { data: cards } = await supabaseSelect<{
      id: string; account_id: string; name: string; last4: string;
      balance: number; credit_limit: number; available_limit: number; updated_at: string;
    }>("credit_cards", { select: "*", order: "updated_at.desc" });

    // Enriquecer com institution_name via accounts → pluggy_items
    const accountIds = Array.from(new Set((cards || []).map((c) => c.account_id)));
    const instByAccountId = new Map<string, string>();

    if (accountIds.length > 0) {
      const { data: accts } = await supabaseSelect<{ id: string; item_id: string; pluggy_account_id: string }>(
        "accounts", { select: "id,item_id,pluggy_account_id", filter: `id=in.(${accountIds.join(",")})` }
      );
      const itemIds = Array.from(new Set((accts || []).map((a) => a.item_id)));
      if (itemIds.length > 0) {
        const { data: items } = await supabaseSelect<{ id: string; institution_name: string }>(
          "pluggy_items", { select: "id,institution_name", filter: `id=in.(${itemIds.join(",")})` }
        );
        const itemMap = new Map<string, string>();
        for (const item of items || []) itemMap.set(item.id, item.institution_name);
        for (const acct of accts || []) instByAccountId.set(acct.id, itemMap.get(acct.item_id) || "—");
      }
    }

    const enrichedCards = (cards || []).map((c) => ({
      ...c,
      accounts: { pluggy_items: { institution_name: instByAccountId.get(c.account_id) || "—" } },
    }));

    // Transações do cartão selecionado
    let transactions = null;
    if (cardId) {
      const card = (cards || []).find((c) => c.id === cardId);
      if (card) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data } = await supabaseSelect("transactions", {
          select: "*",
          filter: `account_id=eq.${card.account_id}&date=gte.${thirtyDaysAgo.toISOString().split("T")[0]}`,
          order: "date.desc",
          limit: 30,
        });
        transactions = data;
      }
    }

    const totalUsed = (cards || []).reduce((sum, c) => sum + Number(c.balance), 0);
    const totalLimit = (cards || []).reduce((sum, c) => sum + Number(c.credit_limit), 0);
    const totalAvailable = (cards || []).reduce((sum, c) => sum + Number(c.available_limit), 0);

    return NextResponse.json({ cards: enrichedCards, transactions, totalUsed, totalLimit, totalAvailable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar cartões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
