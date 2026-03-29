import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseSelect } from "@/lib/supabase/rest";

// Retorna dados consolidados de crédito
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [cardsRes, loansRes, scoreRes, accountsRes, itemsRes] = await Promise.all([
      supabaseSelect<{
        id: string; account_id: string; balance: number; credit_limit: number; available_limit: number;
      }>("credit_cards", { select: "*", order: "updated_at.desc" }),
      supabaseSelect("loans", { select: "*", order: "updated_at.desc" }),
      supabaseSelect("credit_score", { select: "*", order: "updated_at.desc", limit: 1 }),
      supabaseSelect<{ id: string; item_id: string }>("accounts", { select: "id,item_id" }),
      supabaseSelect<{ id: string; institution_name: string }>("pluggy_items", { select: "id,institution_name" }),
    ]);

    const creditCards = cardsRes.data || [];
    const loans = loansRes.data || [];
    const accounts = accountsRes.data || [];
    const items = itemsRes.data || [];

    // Maps para resolver instituição
    const itemMap = new Map<string, string>();
    for (const i of items) itemMap.set(i.id, i.institution_name);
    const acctItemMap = new Map<string, string>();
    for (const a of accounts) acctItemMap.set(a.id, a.item_id);

    // Métricas
    const totalLimit = creditCards.reduce((s, c) => s + Number(c.credit_limit), 0);
    const totalUsed = creditCards.reduce((s, c) => s + Number(c.balance), 0);
    const totalAvailable = creditCards.reduce((s, c) => s + Number(c.available_limit), 0);
    const creditCompromised = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Limites por banco
    const bankMap = new Map<string, { limit: number; used: number; available: number }>();
    for (const card of creditCards) {
      const itemId = acctItemMap.get(card.account_id) || "";
      const inst = itemMap.get(itemId) || "Desconhecido";
      const existing = bankMap.get(inst) || { limit: 0, used: 0, available: 0 };
      existing.limit += Number(card.credit_limit);
      existing.used += Number(card.balance);
      existing.available += Number(card.available_limit);
      bankMap.set(inst, existing);
    }

    const limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }> = [];
    bankMap.forEach((val, institution) => { limitsByBank.push({ institution, ...val }); });

    const totalLoanDebt = loans.reduce((s, l) => s + Number((l as Record<string, unknown>).outstanding_balance || 0), 0);

    return NextResponse.json({
      totalLimit, totalUsed, totalAvailable, creditCompromised,
      limitsByBank, loans, totalLoanDebt,
      score: scoreRes.data?.[0] || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar crédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
