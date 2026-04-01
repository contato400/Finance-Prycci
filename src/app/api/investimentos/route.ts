import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda Fixa", MUTUAL_FUND: "Fundos", EQUITY: "Ações",
  ETF: "ETF", COE: "COE", SECURITY: "Previdência", OTHER: "Outros",
};

// Retorna investimentos agrupados por classe e instituição
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const investments = await sql`
      SELECT i.*, i.balance::float as balance,
             COALESCE(i.quantity, 0)::float as quantity,
             COALESCE(i.value, 0)::float as value,
             p.institution_name
      FROM investments i
      JOIN pluggy_items p ON i.item_id = p.id
      WHERE i.user_id = ${userId}
      ORDER BY i.balance DESC
    `;

    const totalInvested = investments.reduce((s, i) => s + (Number(i.balance) || 0), 0);

    const byClassMap = new Map<string, number>();
    for (const inv of investments) {
      const label = TYPE_LABELS[inv.type] || inv.type;
      byClassMap.set(label, (byClassMap.get(label) || 0) + (Number(inv.balance) || 0));
    }
    const byClass = Array.from(byClassMap.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    const byInstMap = new Map<string, number>();
    for (const inv of investments) {
      const inst = inv.institution_name || "Desconhecido";
      byInstMap.set(inst, (byInstMap.get(inst) || 0) + (Number(inv.balance) || 0));
    }
    const byInstitution = Array.from(byInstMap.entries())
      .map(([institution, total]) => ({ institution, total }))
      .sort((a, b) => b.total - a.total);

    const assets = investments.map((inv) => {
      const balance = Number(inv.balance) || 0;
      const value = Number(inv.value) || 0;
      const profit = value > 0 ? balance - value : 0;
      const profitPct = value > 0 ? ((balance - value) / value) * 100 : 0;

      return {
        id: inv.id, name: inv.name,
        type: TYPE_LABELS[inv.type] || inv.type,
        balance, quantity: Number(inv.quantity) || 0,
        value, profit, profitPct,
        institution: inv.institution_name || "Desconhecido",
      };
    });

    const totalProfit = assets.reduce((s, a) => s + a.profit, 0);

    return NextResponse.json({ totalInvested, totalProfit, byClass, byInstitution, assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar investimentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
