import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseSelect } from "@/lib/supabase/rest";

const TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda Fixa",
  MUTUAL_FUND: "Fundos",
  EQUITY: "Ações",
  ETF: "ETF",
  COE: "COE",
  SECURITY: "Previdência",
  OTHER: "Outros",
};

// Retorna investimentos agrupados por classe e instituição
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const [invRes, itemsRes] = await Promise.all([
      supabaseSelect<{
        id: string; item_id: string; name: string; type: string;
        balance: number; quantity: number; value: number;
      }>("investments", { select: "*", order: "balance.desc" }),
      supabaseSelect<{ id: string; institution_name: string }>(
        "pluggy_items", { select: "id,institution_name" }
      ),
    ]);

    const all = invRes.data || [];
    const itemMap = new Map<string, string>();
    for (const i of itemsRes.data || []) itemMap.set(i.id, i.institution_name);

    const totalInvested = all.reduce((s, i) => s + Number(i.balance), 0);

    // Por classe
    const byClassMap = new Map<string, number>();
    for (const inv of all) {
      const label = TYPE_LABELS[inv.type] || inv.type;
      byClassMap.set(label, (byClassMap.get(label) || 0) + Number(inv.balance));
    }
    const byClass = Array.from(byClassMap.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    // Por instituição
    const byInstMap = new Map<string, number>();
    for (const inv of all) {
      const inst = itemMap.get(inv.item_id) || "Desconhecido";
      byInstMap.set(inst, (byInstMap.get(inst) || 0) + Number(inv.balance));
    }
    const byInstitution = Array.from(byInstMap.entries())
      .map(([institution, total]) => ({ institution, total }))
      .sort((a, b) => b.total - a.total);

    const assets = all.map((inv) => ({
      id: inv.id, name: inv.name,
      type: TYPE_LABELS[inv.type] || inv.type,
      balance: Number(inv.balance),
      quantity: Number(inv.quantity),
      value: Number(inv.value),
      institution: itemMap.get(inv.item_id) || "—",
    }));

    return NextResponse.json({ totalInvested, byClass, byInstitution, assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar investimentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
