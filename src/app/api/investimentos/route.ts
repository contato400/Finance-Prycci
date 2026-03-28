import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

// Mapeamento de tipos Pluggy para classes legíveis em pt-BR
const TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda Fixa",
  MUTUAL_FUND: "Fundos",
  EQUITY: "Ações",
  ETF: "ETF",
  COE: "COE",
  SECURITY: "Previdência",
  OTHER: "Outros",
};

// Retorna investimentos agrupados por classe e por instituição
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseServer();

    const { data: investments } = await supabase
      .from("investments")
      .select("*, pluggy_items(institution_name)")
      .order("balance", { ascending: false });

    const all = investments || [];
    const totalInvested = all.reduce((s, i) => s + Number(i.balance), 0);

    // Agrupar por classe (type)
    const byClassMap = new Map<string, number>();
    for (const inv of all) {
      const label = TYPE_LABELS[inv.type] || inv.type;
      byClassMap.set(label, (byClassMap.get(label) || 0) + Number(inv.balance));
    }
    const byClass: Array<{ type: string; total: number }> = [];
    byClassMap.forEach((total, type) => {
      byClass.push({ type, total });
    });
    byClass.sort((a, b) => b.total - a.total);

    // Agrupar por instituição
    const byInstMap = new Map<string, number>();
    for (const inv of all) {
      const inst = inv.pluggy_items?.institution_name || "Desconhecido";
      byInstMap.set(inst, (byInstMap.get(inst) || 0) + Number(inv.balance));
    }
    const byInstitution: Array<{ institution: string; total: number }> = [];
    byInstMap.forEach((total, institution) => {
      byInstitution.push({ institution, total });
    });
    byInstitution.sort((a, b) => b.total - a.total);

    // Lista de ativos com label do tipo
    const assets = all.map((inv) => ({
      id: inv.id,
      name: inv.name,
      type: TYPE_LABELS[inv.type] || inv.type,
      balance: Number(inv.balance),
      quantity: Number(inv.quantity),
      value: Number(inv.value),
      institution: inv.pluggy_items?.institution_name || "—",
    }));

    return NextResponse.json({
      totalInvested,
      byClass,
      byInstitution,
      assets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar investimentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
