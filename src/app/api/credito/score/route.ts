import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

// Salva score de crédito manualmente
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

    const today = new Date().toISOString().split("T")[0];
    const [row] = await sql`
      INSERT INTO credit_score (score, source, recorded_at, updated_at)
      VALUES (${score}, ${source || "Serasa"}, ${today}, now())
      RETURNING *
    `;

    return NextResponse.json({ score: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
