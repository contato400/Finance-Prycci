import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

// Retorna todos os cartões de crédito com transações recentes
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");

    const supabase = createSupabaseServer();

    // Buscar cartões com dados da conta e instituição
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("*, accounts(id, pluggy_account_id, pluggy_items(institution_name))")
      .order("updated_at", { ascending: false });

    // Se um cardId foi passado, buscar transações recentes desse cartão
    let transactions = null;

    if (cardId) {
      // Buscar account_id do cartão
      const card = (cards || []).find((c) => c.id === cardId);
      if (card) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: txData } = await supabase
          .from("transactions")
          .select("*")
          .eq("account_id", card.account_id)
          .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
          .order("date", { ascending: false })
          .limit(30);

        transactions = txData;
      }
    }

    // Métricas totais
    const totalUsed = (cards || []).reduce((sum, c) => sum + Number(c.balance), 0);
    const totalLimit = (cards || []).reduce((sum, c) => sum + Number(c.limit), 0);
    const totalAvailable = (cards || []).reduce((sum, c) => sum + Number(c.available_limit), 0);

    return NextResponse.json({
      cards: cards || [],
      transactions,
      totalUsed,
      totalLimit,
      totalAvailable,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar cartões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
