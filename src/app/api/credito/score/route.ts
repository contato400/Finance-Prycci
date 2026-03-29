import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseInsert } from "@/lib/supabase/rest";

// Salva ou atualiza o score de crédito manualmente
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { score, source } = (await request.json()) as { score: number; source?: string };

    if (typeof score !== "number" || score < 0 || score > 1000) {
      return NextResponse.json({ error: "Score deve ser entre 0 e 1000" }, { status: 400 });
    }

    const { data, error } = await supabaseInsert("credit_score", {
      score,
      source: source || "Serasa",
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ score: data?.[0] ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
