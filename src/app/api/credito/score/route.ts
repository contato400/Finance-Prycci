import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

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

    const supabase = createSupabaseServer();

    const { data, error } = await supabase
      .from("credit_score")
      .insert({
        score,
        source: source || "Serasa",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ score: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
