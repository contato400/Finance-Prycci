import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

const TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda Fixa", MUTUAL_FUND: "Fundos", EQUITY: "Ações",
  ETF: "ETF", COE: "COE", SECURITY: "Previdência", OTHER: "Outros",
};

// Retorna investimentos agrupados por classe e instituição
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const investments = await sql`
      SELECT i.*, p.institution_name
      FROM investments i
      JOIN pluggy_items p ON i.item_id = p.id
      ORDER BY i.balance DESC
    `;

    const totalInvested = investments.reduce((s, i) => s + Number(i.balance), 0);

    // Por classe
    const byClassMap = new Map<string, number>();
    for (const inv of investments) {
      const label = TYPE_LABELS[inv.type] || inv.type;
      byClassMap.set(label, (byClassMap.get(label) || 0) + Number(inv.balance));
    }
    const byClass = Array.from(byClassMap.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    // Por instituição
    const byInstMap = new Map<string, number>();
    for (const inv of investments) {
      const inst = inv.institution_name || "Desconhecido";
      byInstMap.set(inst, (byInstMap.get(inst) || 0) + Number(inv.balance));
    }
    const byInstitution = Array.from(byInstMap.entries())
      .map(([institution, total]) => ({ institution, total }))
      .sort((a, b) => b.total - a.total);

    const assets = investments.map((inv) => ({
      id: inv.id, name: inv.name,
      type: TYPE_LABELS[inv.type] || inv.type,
      balance: Number(inv.balance), quantity: Number(inv.quantity),
      value: Number(inv.value), institution: inv.institution_name || "—",
    }));

    return NextResponse.json({ totalInvested, byClass, byInstitution, assets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar investimentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
