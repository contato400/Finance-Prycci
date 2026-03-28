import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

// Retorna dados consolidados de crédito
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseServer();

    const [
      { data: creditCards },
      { data: loans },
      { data: creditScore },
    ] = await Promise.all([
      supabase
        .from("credit_cards")
        .select("*, accounts(pluggy_items(institution_name))")
        .order("updated_at", { ascending: false }),
      supabase
        .from("loans")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("credit_score")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    // Métricas de crédito
    const totalLimit = (creditCards || []).reduce((s, c) => s + Number(c.limit), 0);
    const totalUsed = (creditCards || []).reduce((s, c) => s + Number(c.balance), 0);
    const totalAvailable = (creditCards || []).reduce((s, c) => s + Number(c.available_limit), 0);
    const creditCompromised = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Limites por banco
    const limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }> = [];
    const bankMap = new Map<string, { limit: number; used: number; available: number }>();

    for (const card of creditCards || []) {
      const inst = card.accounts?.pluggy_items?.institution_name || "Desconhecido";
      const existing = bankMap.get(inst) || { limit: 0, used: 0, available: 0 };
      existing.limit += Number(card.limit);
      existing.used += Number(card.balance);
      existing.available += Number(card.available_limit);
      bankMap.set(inst, existing);
    }

    bankMap.forEach((val, institution) => {
      limitsByBank.push({ institution, ...val });
    });

    // Total de dívidas em empréstimos
    const totalLoanDebt = (loans || []).reduce((s, l) => s + Number(l.outstanding_balance), 0);

    return NextResponse.json({
      totalLimit,
      totalUsed,
      totalAvailable,
      creditCompromised,
      limitsByBank,
      loans: loans || [],
      totalLoanDebt,
      score: creditScore?.[0] || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar crédito";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
